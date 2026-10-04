const express = require('express')
const cors = require('cors')
const dotenv = require('dotenv')
const multer = require('multer')
const fs = require('fs')
const path = require('path')
const imageRoutes = require('./imageRoutes')

dotenv.config()

const app = express()
const PORT = 5000

app.use(cors())
app.use(express.json())
app.use('/api', imageRoutes)

const creationsDirectory = path.join(__dirname, 'creations')

if (!fs.existsSync(creationsDirectory)) {
  fs.mkdirSync(creationsDirectory, { recursive: true })
}

app.use('/creations', express.static(creationsDirectory))

function safeFileName(value = 'video') {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'video'
}

async function saveGeneratedVideo(sourceUrl, name = 'video') {
  console.log('')
  console.log('Saving video to ANNIVEO...')

  const response = await fetch(sourceUrl)

  if (!response.ok) {
    throw new Error(
      `Could not download generated video. HTTP ${response.status}`
    )
  }

  const arrayBuffer = await response.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)

  const filename = `${safeFileName(name)}-${Date.now()}.mp4`
  const filePath = path.join(creationsDirectory, filename)

  await fs.promises.writeFile(filePath, buffer)

  console.log('ANNIVEO video saved:', filename)

  return {
    filename,
    videoUrl: `http://localhost:${PORT}/creations/${encodeURIComponent(filename)}`,
  }
}

async function saveGeneratedAudio(sourceUrl, name = 'speech') {
  console.log('')
  console.log('Saving speech to ANNIVEO...')

  const response = await fetch(sourceUrl)

  if (!response.ok) {
    throw new Error(
      `Could not download generated speech. HTTP ${response.status}`
    )
  }

  const arrayBuffer = await response.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)

  const contentType =
    response.headers.get('content-type') || ''

  let extension = 'mp3'

  if (contentType.includes('wav')) {
    extension = 'wav'
  } else if (contentType.includes('mpeg')) {
    extension = 'mp3'
  } else if (contentType.includes('mp4')) {
    extension = 'm4a'
  } else if (contentType.includes('aac')) {
    extension = 'aac'
  }

  const filename =
    `${safeFileName(name)}-${Date.now()}.${extension}`

  const filePath =
    path.join(creationsDirectory, filename)

  await fs.promises.writeFile(
    filePath,
    buffer
  )

  console.log(
    'ANNIVEO speech saved:',
    filename
  )

  return {
    filename,
    audioUrl:
      `http://localhost:${PORT}/creations/${encodeURIComponent(filename)}`,
  }
}

// --------------------------------------------------
// Upload configuration
// --------------------------------------------------

const upload = multer({
  storage: multer.memoryStorage(),

  limits: {
    fileSize: 10 * 1024 * 1024,
    files: 4,
  },

  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'image/jpeg',
      'image/png',
      'image/webp',
    ]

    if (!allowedTypes.includes(file.mimetype)) {
      return cb(
        new Error(
          'Only JPG, PNG, and WebP images are allowed.'
        )
      )
    }

    cb(null, true)
  },
})

const videoUpload = upload.fields([
  {
    name: 'image',
    maxCount: 1,
  },
  {
    name: 'characterImages',
    maxCount: 4,
  },
])

// --------------------------------------------------
// Health check
// --------------------------------------------------

app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'ANNIVEO backend is running',
    textToVideo: true,
    imageToVideo: true,
    characterVideo: true,
  })
})

// --------------------------------------------------
// Helpers
// --------------------------------------------------

const sleep = (ms) => {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function getGen45Ratio(ratio) {
  const ratioMap = {
    '16:9': '1280:720',
    '9:16': '720:1280',
  }

  return ratioMap[ratio]
}

function getWan3Ratio(ratio) {
  /*
    We deliberately use WAN 3's 480p dimensions
    for the first character tests.

    16:9 -> 832:480
    9:16 -> 480:832
  */

  const ratioMap = {
    '16:9': '832:480',
    '9:16': '480:832',
  }

  return ratioMap[ratio]
}

function getDuration(duration) {
  return Number(
    String(duration).replace('s', '')
  )
}

function imageToDataUri(file) {
  const base64 = file.buffer.toString('base64')

  return `data:${file.mimetype};base64,${base64}`
}

// --------------------------------------------------
// Wait for Runway generation
// --------------------------------------------------

async function waitForRunwayTask(taskId) {
  const maxChecks = 120

  for (
    let attempt = 1;
    attempt <= maxChecks;
    attempt++
  ) {
    await sleep(5000)

    const response = await fetch(
      `https://api.dev.runwayml.com/v1/tasks/${taskId}`,
      {
        method: 'GET',

        headers: {
          Authorization:
            `Bearer ${process.env.RUNWAYML_API_SECRET}`,

          'X-Runway-Version': '2024-11-06',
        },
      }
    )

    const responseText = await response.text()

    let task

    try {
      task = JSON.parse(responseText)
    } catch {
      throw new Error(
        'Runway returned an unreadable task response.'
      )
    }

    if (!response.ok) {
      console.error(
        'RUNWAY STATUS ERROR:',
        JSON.stringify(task, null, 2)
      )

      throw new Error(
        task?.error ||
          task?.message ||
          'Could not check the Runway task.'
      )
    }

    console.log(
      `Runway status ${attempt}: ${task.status}`
    )

    if (task.status === 'SUCCEEDED') {
      const videoUrl = task.output?.[0]

      if (!videoUrl) {
        throw new Error(
          'Runway completed the task but returned no output URL.'
        )
      }

      return {
        videoUrl,
        task,
      }
    }

    if (
      task.status === 'FAILED' ||
      task.status === 'CANCELED'
    ) {
      console.error(
        'RUNWAY TASK FAILED:',
        JSON.stringify(task, null, 2)
      )

      throw new Error(
        task.failure ||
          task.failureCode ||
          task.message ||
          'Runway could not complete the generation.'
      )
    }
  }

  throw new Error(
    'The Runway generation took longer than expected.'
  )
}

// --------------------------------------------------
// ANNIVEO speech generation
// --------------------------------------------------

async function generateSpeech(dialogue, voice = 'Female') {
  if (!dialogue?.trim()) {
    return null
  }

  const presetId =
    voice.toLowerCase() === 'male'
      ? 'Arjun'
      : 'Maya'

  const requestBody = {
    model: 'eleven_multilingual_v2',
    promptText: dialogue.trim().slice(0, 1000),
    voice: {
      type: 'runway-preset',
      presetId,
    },
  }

  console.log('')
  console.log('======================================')
  console.log('ANNIVEO SPEECH GENERATION')
  console.log('======================================')
  console.log('Voice:', presetId)
  console.log(
    'Characters:',
    requestBody.promptText.length
  )

  const response = await fetch(
    'https://api.dev.runwayml.com/v1/text_to_speech',
    {
      method: 'POST',

      headers: {
        Authorization:
          `Bearer ${process.env.RUNWAYML_API_SECRET}`,

        'Content-Type': 'application/json',

        'X-Runway-Version': '2024-11-06',
      },

      body: JSON.stringify(requestBody),
    }
  )

  const responseText = await response.text()

  let data

  try {
    data = JSON.parse(responseText)
  } catch {
    throw new Error(
      'Runway returned an unreadable speech response.'
    )
  }

  if (!response.ok) {
    console.error(
      'RUNWAY SPEECH ERROR:',
      JSON.stringify(data, null, 2)
    )

    throw new Error(
      data?.error ||
        data?.message ||
        'Runway could not generate speech.'
    )
  }

  if (!data.id) {
    throw new Error(
      'Runway did not return a speech task ID.'
    )
  }

  console.log('Speech task:', data.id)

  const result =
  await waitForRunwayTask(data.id)

const savedAudio =
  await saveGeneratedAudio(
    result.videoUrl,
    `speech-${presetId}`
  )

return {
  audioUrl: savedAudio.audioUrl,
  filename: savedAudio.filename,
  task: result.task,
}
}

async function createRunwayAvatar({
  name,
  referenceImage,
  voicePreset = 'maya',
}) {
  console.log('')
  console.log('======================================')
  console.log('ANNIVEO CUSTOM AVATAR')
  console.log('======================================')
  console.log('Name:', name)
  console.log('Voice:', voicePreset)

  if (!name) {
    throw new Error(
      'A character name is required to create an avatar.'
    )
  }

  if (!referenceImage) {
    throw new Error(
      'A reference image is required to create an avatar.'
    )
  }

  const requestBody = {
    name,
    personality:
      `${name} is a natural, expressive character used for ANNIVEO videos.`,
    referenceImage,
    voice: {
      presetId: voicePreset,
      type: 'runway-live-preset',
    },
    imageProcessing: 'optimize',
  }

  const response = await fetch(
    'https://api.dev.runwayml.com/v1/avatars',
    {
      method: 'POST',

      headers: {
        Authorization:
          `Bearer ${process.env.RUNWAYML_API_SECRET}`,

        'Content-Type': 'application/json',

        'X-Runway-Version': '2024-11-06',
      },

      body: JSON.stringify(requestBody),
    }
  )

  const responseText = await response.text()

  let avatar

  try {
    avatar = JSON.parse(responseText)
  } catch {
    throw new Error(
      'Runway returned an unreadable avatar response.'
    )
  }

  if (!response.ok) {
    console.error(
      'RUNWAY AVATAR ERROR:',
      JSON.stringify(avatar, null, 2)
    )

    throw new Error(
      avatar?.error ||
        avatar?.message ||
        'Runway could not create the avatar.'
    )
  }

  console.log('Avatar ID:', avatar.id)
  console.log('Avatar status:', avatar.status)

  return avatar
}

async function generateAvatarVideo({
  avatarId,
  dialogue,
  voicePreset = 'maya',
}) {
  console.log('')
  console.log('======================================')
  console.log('ANNIVEO TALKING AVATAR')
  console.log('======================================')
  console.log('Avatar ID:', avatarId)
  console.log('Dialogue:', dialogue)
  console.log('Voice:', voicePreset)

  if (!avatarId) {
    throw new Error(
      'An avatar ID is required.'
    )
  }

  if (!dialogue?.trim()) {
    throw new Error(
      'Dialogue is required for a talking video.'
    )
  }

  const requestBody = {
    avatar: {
      type: 'custom',
      avatarId,
    },

    model: 'gwm1_avatars',

    speech: {
      type: 'text',
      text: dialogue.trim(),
      voice: {
        type: 'preset',
        presetId: voicePreset,
      },
    },
  }

  const response = await fetch(
    'https://api.dev.runwayml.com/v1/avatar_videos',
    {
      method: 'POST',

      headers: {
        Authorization:
          `Bearer ${process.env.RUNWAYML_API_SECRET}`,

        'Content-Type': 'application/json',

        'X-Runway-Version': '2024-11-06',
      },

      body: JSON.stringify(requestBody),
    }
  )

  const responseText = await response.text()

  let data

  try {
    data = JSON.parse(responseText)
  } catch {
    throw new Error(
      'Runway returned an unreadable avatar video response.'
    )
  }

  if (!response.ok) {
    console.error(
      'RUNWAY AVATAR VIDEO ERROR:',
      JSON.stringify(data, null, 2)
    )

    throw new Error(
      data?.error ||
        data?.message ||
        'Runway could not create the talking avatar video.'
    )
  }

  console.log(
    'Talking avatar task:',
    data.id
  )

  const result =
    await waitForRunwayTask(data.id)

  const savedVideo =
    await saveGeneratedVideo(
      result.videoUrl,
      'honey-talking'
    )

  return {
    taskId: data.id,
    videoUrl: savedVideo.videoUrl,
    filename: savedVideo.filename,
    task: result.task,
  }
}

    

  
    
    
 


// --------------------------------------------------
// Gen-4.5
//
// Used for:
// 1. ordinary text-to-video
// 2. ordinary single image-to-video
// --------------------------------------------------

async function createGen45Video({
  prompt,
  ratio,
  duration,
  promptImage,
}) {
  const requestBody = {
    model: 'gen4.5',
    promptText: prompt,
    ratio,
    duration,
  }

  let endpoint

  if (promptImage) {
    endpoint =
      'https://api.dev.runwayml.com/v1/image_to_video'

    requestBody.promptImage = promptImage
  } else {
    endpoint =
      'https://api.dev.runwayml.com/v1/text_to_video'
  }

  console.log('')
  console.log('======================================')
  console.log('ANNIVEO GEN-4.5 REQUEST')
  console.log('======================================')

  console.log(
    'Mode:',
    promptImage
      ? 'IMAGE TO VIDEO'
      : 'TEXT TO VIDEO'
  )

  console.log('Model: gen4.5')
  console.log('Ratio:', ratio)
  console.log('Duration:', duration)
  console.log('Prompt:', prompt)

  const response = await fetch(endpoint, {
    method: 'POST',

    headers: {
      Authorization:
        `Bearer ${process.env.RUNWAYML_API_SECRET}`,

      'Content-Type': 'application/json',

      'X-Runway-Version': '2024-11-06',
    },

    body: JSON.stringify(requestBody),
  })

  const responseText = await response.text()

  let data

  try {
    data = JSON.parse(responseText)
  } catch {
    console.error(
      'Unexpected Runway response:',
      responseText
    )

    throw new Error(
      'Runway returned an unexpected response.'
    )
  }

  if (!response.ok) {
    console.error('')
    console.error('RUNWAY REQUEST REJECTED')
    console.error('HTTP:', response.status)

    console.error(
      JSON.stringify(data, null, 2)
    )

    const detailedIssue =
      data?.issues?.[0]?.message

    throw new Error(
      detailedIssue ||
        data?.error ||
        data?.message ||
        'Runway rejected the generation request.'
    )
  }

  if (!data.id) {
    throw new Error(
      'Runway did not return a task ID.'
    )
  }

  console.log(
    'Runway accepted Gen-4.5 request.'
  )
  console.log('Task ID:', data.id)

  return data.id
}

// --------------------------------------------------
// WAN 3 CHARACTER VIDEO
//
// Receives 1-4 ANNIVEO character references.
// --------------------------------------------------

async function createCharacterVideo({
  characterName,
  characterImages,
  prompt,
  ratio,
  duration,
}) {
  if (!characterImages.length) {
    throw new Error(
      'No character reference images were received.'
    )
  }

  const references = characterImages.map(
    (file) => ({
      uri: imageToDataUri(file),
    })
  )

  /*
    WAN 3 can address references in the prompt as
    [Image 1], [Image 2], etc.

    Every supplied image represents the same
    ANNIVEO character.
  */

  const referenceLabels = references
    .map(
      (_, index) =>
        `[Image ${index + 1}]`
    )
    .join(', ')

  const characterPrompt = `
${referenceLabels} are reference images of the same person named ${characterName}.

Maintain ${characterName}'s identity throughout the entire video. Preserve the same facial structure, eyes, nose, lips, complexion, apparent age, hairstyle, and overall recognizable appearance shown in the reference images.

Do not substitute another person. Do not redesign the face. Keep facial proportions stable from the first frame to the last frame.

Scene and movement:
${prompt}
  `.trim()

  const requestBody = {
    model: 'wan3',
    promptText: characterPrompt,
    ratio,
    duration,
    audio: false,
    references,
  }

  console.log('')
  console.log('======================================')
  console.log('ANNIVEO CHARACTER GENERATION')
  console.log('======================================')
  console.log('Character:', characterName)
  console.log('Model: wan3')

  console.log(
    'References:',
    references.length
  )

  console.log('Ratio:', ratio)
  console.log('Duration:', duration)
  console.log('Audio: disabled')
  console.log('Prompt:', prompt)

  characterImages.forEach(
    (file, index) => {
      console.log(
        `Reference ${index + 1}:`,
        file.originalname,
        `${(
          file.size /
          1024 /
          1024
        ).toFixed(2)} MB`
      )
    }
  )

  console.log('')
  console.log(
    'Sending character references to Runway...'
  )

  const response = await fetch(
    'https://api.dev.runwayml.com/v1/text_to_video',
    {
      method: 'POST',

      headers: {
        Authorization:
          `Bearer ${process.env.RUNWAYML_API_SECRET}`,

        'Content-Type': 'application/json',

        'X-Runway-Version': '2024-11-06',
      },

      body: JSON.stringify(requestBody),
    }
  )

  const responseText = await response.text()

  let data

  try {
    data = JSON.parse(responseText)
  } catch {
    console.error(
      'Unexpected WAN 3 response:',
      responseText
    )

    throw new Error(
      'Runway returned an unexpected WAN 3 response.'
    )
  }

  if (!response.ok) {
    console.error('')
    console.error('WAN 3 REQUEST REJECTED')
    console.error('HTTP:', response.status)

    console.error(
      JSON.stringify(data, null, 2)
    )

    const detailedIssue =
      data?.issues?.[0]?.message

    throw new Error(
      detailedIssue ||
        data?.error ||
        data?.message ||
        'Runway rejected the character generation request.'
    )
  }

  if (!data.id) {
    console.error(
      'WAN 3 response:',
      JSON.stringify(data, null, 2)
    )

    throw new Error(
      'Runway did not return a character generation task ID.'
    )
  }

  console.log('')
  console.log(
    'WAN 3 accepted the character request.'
  )
  console.log('Task ID:', data.id)
  console.log(
    'Generating character video...'
  )

  return data.id
}
// --------------------------------------------------
// Speech test route
// --------------------------------------------------

app.post('/api/test-speech', async (req, res) => {
  try {
    const dialogue =
      req.body?.dialogue?.trim()

    const voice =
      req.body?.voice || 'Female'

    if (!dialogue) {
      return res.status(400).json({
        success: false,
        message: 'Please enter dialogue to speak.',
      })
    }

    if (!process.env.RUNWAYML_API_SECRET) {
      return res.status(500).json({
        success: false,
        message: 'Runway API key is missing.',
      })
    }

    const speechResult =
      await generateSpeech(dialogue, voice)

    return res.json({
      success: true,
      message: 'ANNIVEO speech is ready.',
      audioUrl: speechResult.audioUrl,
      voice,
    })
  } catch (error) {
    console.error('')
    console.error('ANNIVEO SPEECH TEST ERROR')
    console.error(error?.stack || error)

    return res.status(500).json({
      success: false,
      message:
        error?.message ||
        'ANNIVEO could not generate speech.',
    })
  }
})
// --------------------------------------------------
// Create custom ANNIVEO avatar
// --------------------------------------------------

app.post(
  '/api/create-avatar',
  express.json({ limit: '8mb' }),
  async (req, res) => {
    try {
      const name =
        req.body?.name?.trim()

      const referenceImage =
        req.body?.referenceImage

      const voicePreset =
        req.body?.voicePreset || 'maya'

      if (!name) {
        return res.status(400).json({
          success: false,
          message:
            'Please provide a character name.',
        })
      }

      if (!referenceImage) {
        return res.status(400).json({
          success: false,
          message:
            'Please provide a reference image.',
        })
      }

      if (!process.env.RUNWAYML_API_SECRET) {
        return res.status(500).json({
          success: false,
          message:
            'Runway API key is missing.',
        })
      }

      const avatar =
        await createRunwayAvatar({
          name,
          referenceImage,
          voicePreset,
        })

      return res.json({
        success: true,
        message:
          'ANNIVEO avatar creation started.',
        avatar,
      })
    } catch (error) {
      console.error(
        'ANNIVEO AVATAR ERROR:',
        error
      )

      return res.status(500).json({
        success: false,
        message:
          error?.message ||
          'ANNIVEO could not create the avatar.',
      })
    }
  }
)
// --------------------------------------------------
// Generate talking avatar video
// --------------------------------------------------

app.post(
  '/api/talking-avatar',
  async (req, res) => {
    try {
      const avatarId =
        req.body?.avatarId?.trim()

      const dialogue =
        req.body?.dialogue?.trim()

      const voicePreset =
        req.body?.voicePreset || 'maya'

      if (!avatarId) {
        return res.status(400).json({
          success: false,
          message:
            'Please provide an avatar ID.',
        })
      }

      if (!dialogue) {
        return res.status(400).json({
          success: false,
          message:
            'Please enter dialogue for the character.',
        })
      }

      if (!process.env.RUNWAYML_API_SECRET) {
        return res.status(500).json({
          success: false,
          message:
            'Runway API key is missing.',
        })
      }

      const result =
        await generateAvatarVideo({
          avatarId,
          dialogue,
          voicePreset,
        })

      return res.json({
        success: true,
        message:
          'ANNIVEO talking video is ready.',
        ...result,
      })
    } catch (error) {
      console.error(
        'ANNIVEO TALKING AVATAR ERROR:',
        error
      )

      return res.status(500).json({
        success: false,
        message:
          error?.message ||
          'ANNIVEO could not generate the talking video.',
      })
    }
  }
)
// --------------------------------------------------
// Main video generation route
// --------------------------------------------------

app.post(
  '/api/generate-video',

  videoUpload,

  async (req, res) => {
    try {
      const prompt =
        req.body?.prompt?.trim()

      const quality =
        req.body?.quality || 'high'

      const ratio =
        req.body?.ratio || '16:9'

      const duration =
        req.body?.duration || '5s'

      const generationMode =
        req.body?.generationMode ||
        'standard'

      const characterName =
        req.body?.characterName?.trim()

      const dialogue =
        req.body?.dialogue?.trim() || ''

      const language =
        req.body?.language || 'English'

      const voice =
        req.body?.voice || 'Female'

      const lipSync =
        req.body?.lipSync === 'true'

      console.log('')
      console.log('ANNIVEO VIDEO OPTIONS')
      console.log(
        'Dialogue:',
        dialogue || '(none)'
      )
      console.log('Language:', language)
      console.log('Voice:', voice)
      console.log('Lip Sync:', lipSync)

      if (!prompt) {
        return res.status(400).json({
          success: false,

          message:
            'Please describe the video you want to create.',
        })
      }

      if (
        !process.env.RUNWAYML_API_SECRET
      ) {
        return res.status(500).json({
          success: false,

          message:
            'Runway API key is missing.',
        })
      }

      const durationNumber =
        getDuration(duration)

      if (
        !Number.isFinite(
          durationNumber
        ) ||
        ![5, 10].includes(
          durationNumber
        )
      ) {
        return res.status(400).json({
          success: false,

          message:
            'Please select a 5s or 10s duration.',
        })
      }

      // --------------------------------------------
      // Generate speech when dialogue is supplied
      // --------------------------------------------

      let speechResult = null

      if (dialogue) {
        console.log('')
        console.log(
          'Dialogue detected. Generating speech...'
        )

        speechResult =
          await generateSpeech(
            dialogue,
            voice
          )

        console.log(
          'ANNIVEO speech ready.'
        )

        console.log(
          'Speech URL:',
          speechResult.audioUrl
        )
      }

      // --------------------------------------------
      // SAVED CHARACTER MODE
      // --------------------------------------------

      if (
        generationMode === 'character'
      ) {
        const characterImages =
          req.files?.characterImages || []

        if (!characterName) {
          return res.status(400).json({
            success: false,

            message:
              'Character name is missing.',
          })
        }

        if (
          characterImages.length === 0
        ) {
          return res.status(400).json({
            success: false,

            message:
              'No character reference images were received.',
          })
        }

        const wanRatio =
          getWan3Ratio(ratio)

        if (!wanRatio) {
          return res.status(400).json({
            success: false,

            message:
              'Please select 16:9 or 9:16.',
          })
        }

        const taskId =
          await createCharacterVideo({
            characterName,
            characterImages,
            prompt,
            ratio: wanRatio,
            duration: durationNumber,
          })

        const result =
          await waitForRunwayTask(
            taskId
          )

        const savedVideo =
          await saveGeneratedVideo(
            result.videoUrl,
            characterName
          )

        console.log('')
        console.log(
          '======================================'
        )
        console.log(
          'CHARACTER VIDEO COMPLETED'
        )
        console.log(
          '======================================'
        )
        console.log(
          'Character:',
          characterName
        )
        console.log(
          'References used:',
          characterImages.length
        )
        console.log(
          'Task ID:',
          taskId
        )

        if (speechResult) {
          console.log(
            'Speech generated: yes'
          )
        }

        console.log(
          '======================================'
        )

        return res.json({
          success: true,

          message:
            `${characterName}'s ANNIVEO video is ready.`,

          videoUrl:
            savedVideo.videoUrl,

          filename:
            savedVideo.filename,

          audioUrl:
            speechResult?.audioUrl ||
            null,

          taskId,

          mode:
            'character-video',

          model:
            'wan3',

          characterName,

          referenceCount:
            characterImages.length,

          language,

          voice,

          lipSync,
        })
      }

      // --------------------------------------------
      // NORMAL TEXT / SINGLE IMAGE MODE
      // --------------------------------------------

      const runwayRatio =
        getGen45Ratio(ratio)

      if (!runwayRatio) {
        return res.status(400).json({
          success: false,

          message:
            'Please select 16:9 or 9:16.',
        })
      }

      const imageFiles =
        req.files?.image || []

      const imageFile =
        imageFiles[0]

      let promptImage

      if (imageFile) {
        promptImage =
          imageToDataUri(imageFile)

        console.log('')
        console.log(
          'Reference image:',
          imageFile.originalname
        )

        console.log(
          'Image type:',
          imageFile.mimetype
        )

        console.log(
          'Image size:',
          `${(
            imageFile.size /
            1024 /
            1024
          ).toFixed(2)} MB`
        )
      }

      const taskId =
        await createGen45Video({
          prompt,
          ratio: runwayRatio,
          duration: durationNumber,
          promptImage,
        })

      const result =
        await waitForRunwayTask(
          taskId
        )

      console.log('')
      console.log(
        '======================================'
      )
      console.log(
        'ANNIVEO VIDEO COMPLETED'
      )
      console.log(
        '======================================'
      )
      console.log(
        'Task ID:',
        taskId
      )

      if (speechResult) {
        console.log(
          'Speech generated: yes'
        )
      }

      return res.json({
        success: true,

        message: imageFile
          ? 'Your ANNIVEO image-to-video creation is ready.'
          : 'Your ANNIVEO video is ready.',

        videoUrl:
          result.videoUrl,

        audioUrl:
          speechResult?.audioUrl ||
          null,

        taskId,

        mode: imageFile
          ? 'image-to-video'
          : 'text-to-video',

        language,

        voice,

        lipSync,
      })
    } catch (error) {
      console.error('')
      console.error(
        'ANNIVEO GENERATION ERROR'
      )

      console.error(
        error?.stack || error
      )

      return res.status(500).json({
        success: false,

        message:
          error?.message ||
          'ANNIVEO could not generate the video.',
      })
    }
  }
)

// --------------------------------------------------
// Upload error handling
// --------------------------------------------------

app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,

        message:
          'An image is too large. Please use a smaller image.',
      })
    }

    if (error.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        success: false,

        message:
          'Too many images were uploaded.',
      })
    }

    if (
      error.code === 'LIMIT_UNEXPECTED_FILE'
    ) {
      return res.status(400).json({
        success: false,

        message:
          'ANNIVEO received an unexpected image field.',
      })
    }

    return res.status(400).json({
      success: false,
      message: error.message,
    })
  }

  if (error) {
    return res.status(400).json({
      success: false,

      message:
        error.message ||
        'The image could not be uploaded.',
    })
  }

  next()
})

// --------------------------------------------------
// Start server
// --------------------------------------------------

app.listen(PORT, () => {
  console.log('')
  console.log('======================================')
  console.log('ANNIVEO BACKEND')
  console.log('======================================')

  console.log(
    `Running: http://localhost:${PORT}`
  )

  console.log(
    'Text-to-video: Gen-4.5 ready'
  )

  console.log(
    'Image-to-video: Gen-4.5 ready'
  )

  console.log(
    'Character video: WAN 3 ready'
  )

  console.log(
    'Character references: up to 4'
  )

  console.log(
    'Text-to-speech: Eleven Multilingual v2 ready'
  )

  console.log('======================================')
})