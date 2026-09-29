const express = require('express')
const multer = require('multer')
const fs = require('fs')
const path = require('path')

const router = express.Router()

// --------------------------------------------------
// Image upload configuration
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
          'Only JPG, PNG, and WebP reference images are allowed.'
        )
      )
    }

    cb(null, true)
  },
})

// --------------------------------------------------
// Helpers
// --------------------------------------------------

const sleep = (ms) => {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function imageToDataUri(file) {
  const base64 = file.buffer.toString('base64')

  return `data:${file.mimetype};base64,${base64}`
}

function safeFileName(value) {
  return String(value || 'image')
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50) || 'image'
}

async function waitForImageTask(taskId) {
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
      throw new Error(
        task?.error ||
          task?.message ||
          'Could not check the image-generation task.'
      )
    }

    console.log(
      `Image generation status ${attempt}: ${task.status}`
    )

    if (task.status === 'SUCCEEDED') {
      const imageUrl = task.output?.[0]

      if (!imageUrl) {
        throw new Error(
          'Runway completed the image but returned no image URL.'
        )
      }

      return {
        imageUrl,
        raw: task,
      }
    }

    if (
      task.status === 'FAILED' ||
      task.status === 'CANCELED'
    ) {
      throw new Error(
        task.failure ||
          task.error ||
          'Image generation failed.'
      )
    }
  }

  throw new Error(
    'Image generation took too long to complete.'
  )
}

// --------------------------------------------------
// POST /api/generate-image
// --------------------------------------------------

router.post(
  '/generate-image',
  upload.array('referenceImages', 4),

  async (req, res) => {
    try {
      const prompt = req.body?.prompt?.trim()

      const quality =
        req.body?.quality === 'fast'
          ? 'fast'
          : 'high'

      const ratio =
        req.body?.ratio || '1:1'

      const characterName =
        req.body?.characterName?.trim()

      if (!prompt) {
        return res.status(400).json({
          success: false,
          message:
            'Please describe the image you want to create.',
        })
      }

      if (!process.env.RUNWAYML_API_SECRET) {
        return res.status(500).json({
          success: false,
          message:
            'Runway API key is missing.',
        })
      }

      const ratioMap = {
        '1:1': '1024:1024',
        '16:9': '1920:1080',
        '9:16': '1080:1920',
        '4:5': '1080:1350',
      }

      const imageRatio = ratioMap[ratio]

      if (!imageRatio) {
        return res.status(400).json({
          success: false,
          message:
            'Please select a valid image ratio.',
        })
      }

      const model =
        quality === 'fast'
          ? 'gen4_image_turbo'
          : 'gen4_image'

      const referenceImages =
        (req.files || []).map(
          (file, index) => ({
            uri: imageToDataUri(file),
            tag: `reference${index + 1}`,
          })
        )

      let finalPrompt = `
Create a polished, high-quality image.

User request:
${prompt}

Quality requirements:
Clean composition.
Sharp subject detail.
Natural facial proportions.
Realistic eyes.
Natural skin texture.
Detailed hair and clothing.
Accurate anatomy.
Well-formed hands and fingers.
Balanced professional lighting.
Clean edges.
Coherent background.

Do not add unwanted text, logos, watermarks,
duplicate people, extra limbs, malformed hands,
distorted faces, or stray objects.
      `.trim()

      if (
        characterName &&
        referenceImages.length > 0
      ) {
        const referenceTags =
          referenceImages
            .map((image) => `@${image.tag}`)
            .join(', ')

        finalPrompt = `
${referenceTags} show the same person named ${characterName}.

Preserve ${characterName}'s recognizable identity
from the supplied reference images.

Keep the same facial structure, complexion,
apparent age, eyes, nose, lips, face shape,
and natural facial proportions.

The reference images define identity.
The written request controls the scene,
clothing, pose, expression, lighting,
environment, and composition.

User request:
${prompt}

Create a polished, high-quality image.
Use realistic anatomy, natural skin texture,
detailed hair and clothing, accurate hands
and fingers, balanced lighting, sharp subject
detail, clean edges, and a coherent background.

Do not replace the person with another identity.
Do not redesign the face.
Do not add unwanted text, logos, watermarks,
duplicate people, extra limbs, malformed hands,
or distorted facial features.
        `.trim()
      }

      const requestBody = {
        model,
        promptText: finalPrompt,
        ratio: imageRatio,
      }

      if (referenceImages.length > 0) {
        requestBody.referenceImages =
          referenceImages
      }

      console.log('')
      console.log('======================================')
      console.log('ANNIVEO IMAGE GENERATION')
      console.log('======================================')
      console.log('Model:', model)
      console.log('Quality:', quality)
      console.log('Ratio:', imageRatio)
      console.log(
        'References:',
        referenceImages.length
      )

      if (characterName) {
        console.log(
          'Character:',
          characterName
        )
      }

      const response = await fetch(
        'https://api.dev.runwayml.com/v1/text_to_image',
        {
          method: 'POST',

          headers: {
            Authorization:
              `Bearer ${process.env.RUNWAYML_API_SECRET}`,

            'Content-Type':
              'application/json',

            'X-Runway-Version':
              '2024-11-06',
          },

          body: JSON.stringify(requestBody),
        }
      )

      const responseText =
        await response.text()

      let data

      try {
        data = JSON.parse(responseText)
      } catch {
        throw new Error(
          'Runway returned an unreadable image-generation response.'
        )
      }

      if (!response.ok) {
        console.error(
          'IMAGE REQUEST REJECTED:',
          JSON.stringify(data, null, 2)
        )

        const detailedIssue =
          data?.issues?.[0]?.message

        throw new Error(
          detailedIssue ||
            data?.error ||
            data?.message ||
            'Runway rejected the image-generation request.'
        )
      }

      if (!data.id) {
        throw new Error(
          'Runway did not return an image-generation task ID.'
        )
      }

      console.log(
        'Image task accepted:',
        data.id
      )

      const result =
        await waitForImageTask(data.id)

      const imageResponse =
        await fetch(result.imageUrl)

      if (!imageResponse.ok) {
        throw new Error(
          'ANNIVEO could not download the generated image.'
        )
      }

      const imageBuffer =
        Buffer.from(
          await imageResponse.arrayBuffer()
        )

      const creationsDirectory =
        path.join(__dirname, 'creations')

      if (
        !fs.existsSync(creationsDirectory)
      ) {
        fs.mkdirSync(
          creationsDirectory,
          { recursive: true }
        )
      }

      const name =
        characterName || 'image'

      const filename =
        `${safeFileName(name)}-${Date.now()}.png`

      const filePath =
        path.join(
          creationsDirectory,
          filename
        )

      await fs.promises.writeFile(
        filePath,
        imageBuffer
      )

      const imageUrl =
        `http://localhost:5000/creations/${encodeURIComponent(filename)}`

      console.log(
        'ANNIVEO image saved:',
        filename
      )

      console.log('======================================')

      return res.json({
        success: true,
        message:
          'Your ANNIVEO image is ready.',
        imageUrl,
        filename,
        taskId: data.id,
        model,
        quality,
        ratio,
        characterName:
          characterName || null,
      })
    } catch (error) {
      console.error('')
      console.error(
        'ANNIVEO IMAGE GENERATION ERROR'
      )

      console.error(
        error?.stack || error
      )

      return res.status(500).json({
        success: false,

        message:
          error?.message ||
          'ANNIVEO could not generate the image.',
      })
    }
  }
)

module.exports = router