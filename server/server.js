const express = require('express')
const cors = require('cors')
const dotenv = require('dotenv')
const multer = require('multer')

dotenv.config()

const app = express()
const PORT = 5000

app.use(cors())
app.use(express.json())

// Store uploaded images in memory.
// We only need the image long enough to send it to Runway.
const upload = multer({
  storage: multer.memoryStorage(),

  limits: {
    fileSize: 10 * 1024 * 1024,
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

// --------------------------------------------------
// Health check
// --------------------------------------------------

app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'ANNIVEO backend is running',
  })
})

// --------------------------------------------------
// Helpers
// --------------------------------------------------

const sleep = (ms) => {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function getRatio(ratio) {
  const ratioMap = {
    '16:9': '1280:720',
    '9:16': '720:1280',
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
// Check Runway task until complete
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
          'Runway completed the task but returned no video URL.'
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
          'Runway could not generate the video.'
      )
    }
  }

  throw new Error(
    'The Runway generation took longer than expected.'
  )
}

// --------------------------------------------------
// Create Runway generation
// --------------------------------------------------

async function createRunwayVideo({
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
  console.log('ANNIVEO RUNWAY REQUEST')
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
    console.error(
      'Runway response:',
      JSON.stringify(data, null, 2)
    )

    throw new Error(
      'Runway did not return a task ID.'
    )
  }

  console.log('')
  console.log('Runway accepted the request.')
  console.log('Task ID:', data.id)
  console.log('Generating...')

  return data.id
}

// --------------------------------------------------
// Generate video
//
// This route accepts multipart/form-data.
// "image" is optional.
// --------------------------------------------------

app.post(
  '/api/generate-video',
  upload.single('image'),

  async (req, res) => {
    try {
      const prompt = req.body.prompt?.trim()
      const ratio = req.body.ratio
      const duration = req.body.duration

      if (!prompt) {
        return res.status(400).json({
          success: false,
          message:
            'Please describe the video you want to create.',
        })
      }

      if (!process.env.RUNWAYML_API_SECRET) {
        return res.status(500).json({
          success: false,
          message:
            'Runway API key is missing.',
        })
      }

      const runwayRatio = getRatio(ratio)
      const durationNumber =
        getDuration(duration)

      if (!runwayRatio) {
        return res.status(400).json({
          success: false,
          message:
            'Please select 16:9 or 9:16.',
        })
      }

      if (
        !Number.isFinite(durationNumber) ||
        ![5, 10].includes(durationNumber)
      ) {
        return res.status(400).json({
          success: false,
          message:
            'Please select a 5s or 10s duration.',
        })
      }

      let promptImage

      if (req.file) {
        promptImage =
          imageToDataUri(req.file)

        console.log('')
        console.log(
          'Reference image:',
          req.file.originalname
        )

        console.log(
          'Image type:',
          req.file.mimetype
        )

        console.log(
          'Image size:',
          `${(
            req.file.size /
            1024 /
            1024
          ).toFixed(2)} MB`
        )
      }

      const taskId =
        await createRunwayVideo({
          prompt,
          ratio: runwayRatio,
          duration: durationNumber,
          promptImage,
        })

      const result =
        await waitForRunwayTask(taskId)

      console.log('')
      console.log('======================================')
      console.log('ANNIVEO VIDEO COMPLETED')
      console.log('======================================')
      console.log('Task ID:', taskId)

      return res.json({
        success: true,

        message: req.file
          ? 'Your ANNIVEO image-to-video creation is ready.'
          : 'Your ANNIVEO video is ready.',

        videoUrl: result.videoUrl,

        taskId,

        mode: req.file
          ? 'image-to-video'
          : 'text-to-video',
      })
    } catch (error) {
      console.error('')
      console.error('ANNIVEO GENERATION ERROR')
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
// Multer / upload error handler
// --------------------------------------------------

app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message:
          'The image is too large. Please use an image smaller than 10 MB.',
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
    'Text-to-video: ready'
  )
  console.log(
    'Image-to-video: ready'
  )
  console.log('======================================')
})