const express = require('express')
const cors = require('cors')
const dotenv = require('dotenv')

dotenv.config()

const app = express()
const PORT = 5000

app.use(cors())
app.use(express.json())

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
// Helper
// --------------------------------------------------

const sleep = (ms) => {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// --------------------------------------------------
// Generate video
// --------------------------------------------------

app.post('/api/generate-video', async (req, res) => {
  try {
    const { prompt, ratio, duration } = req.body

    // Validate prompt
    if (!prompt || !prompt.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Please enter a video prompt.',
      })
    }

    // Check Runway API key
    if (!process.env.RUNWAYML_API_SECRET) {
      return res.status(500).json({
        success: false,
        message: 'Runway API key is missing.',
      })
    }

    // Convert ANNIVEO aspect ratio
    const ratioMap = {
      '16:9': '1280:720',
      '9:16': '720:1280',
    }

    const runwayRatio = ratioMap[ratio]

    if (!runwayRatio) {
      return res.status(400).json({
        success: false,
        message: 'Please select 16:9 or 9:16.',
      })
    }

    // Convert "5s" to 5
    const durationNumber = Number(
      String(duration).replace('s', '')
    )

    if (
      !Number.isFinite(durationNumber) ||
      durationNumber < 2 ||
      durationNumber > 10
    ) {
      return res.status(400).json({
        success: false,
        message: 'Duration must be between 2 and 10 seconds.',
      })
    }

    console.log('')
    console.log('======================================')
    console.log('ANNIVEO GENERATION REQUEST')
    console.log('======================================')
    console.log('Prompt:', prompt)
    console.log('Ratio:', runwayRatio)
    console.log('Duration:', durationNumber)
    console.log('Model: gen4.5')
    console.log('')

    // --------------------------------------------------
    // Send TEXT-TO-VIDEO request
    // --------------------------------------------------

    const requestBody = {
      model: 'gen4.5',
      promptText: prompt.trim(),
      ratio: runwayRatio,
      duration: durationNumber,
    }

    const createResponse = await fetch(
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

    const responseText = await createResponse.text()

    let createData

    try {
      createData = JSON.parse(responseText)
    } catch {
      console.error('Runway returned:')
      console.error(responseText)

      return res.status(502).json({
        success: false,
        message: 'Runway returned an unexpected response.',
      })
    }

    // --------------------------------------------------
    // Runway rejected request
    // --------------------------------------------------

    if (!createResponse.ok) {
      console.error('')
      console.error('RUNWAY REQUEST REJECTED')
      console.error('HTTP:', createResponse.status)

      console.error(
        JSON.stringify(createData, null, 2)
      )

      return res.status(createResponse.status).json({
        success: false,

        message:
          createData?.error ||
          createData?.message ||
          'Runway rejected the video request.',

        details: createData,
      })
    }

    // --------------------------------------------------
    // Task created
    // --------------------------------------------------

    const taskId = createData.id

    if (!taskId) {
      console.error('No task ID returned.')

      console.error(
        JSON.stringify(createData, null, 2)
      )

      return res.status(502).json({
        success: false,
        message: 'Runway did not return a task ID.',
      })
    }

    console.log('Runway accepted the request.')
    console.log('Task ID:', taskId)
    console.log('')
    console.log('Generating video...')

    // --------------------------------------------------
    // Check generation status
    // --------------------------------------------------

    const maxChecks = 120

    for (
      let attempt = 1;
      attempt <= maxChecks;
      attempt++
    ) {
      await sleep(5000)

      const statusResponse = await fetch(
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

      const statusText =
        await statusResponse.text()

      let task

      try {
        task = JSON.parse(statusText)
      } catch {
        console.error(
          'Invalid task response:',
          statusText
        )

        return res.status(502).json({
          success: false,
          message:
            'Could not read Runway generation status.',
        })
      }

      if (!statusResponse.ok) {
        console.error('')
        console.error('STATUS CHECK FAILED')

        console.error(
          JSON.stringify(task, null, 2)
        )

        return res.status(statusResponse.status).json({
          success: false,
          message:
            task?.error ||
            'Could not check video status.',
        })
      }

      console.log(
        `Status ${attempt}: ${task.status}`
      )

      // ------------------------------------------------
      // Success
      // ------------------------------------------------

      if (task.status === 'SUCCEEDED') {
        const videoUrl = task.output?.[0]

        if (!videoUrl) {
          console.error(
            JSON.stringify(task, null, 2)
          )

          return res.status(502).json({
            success: false,
            message:
              'Runway completed the video but returned no URL.',
          })
        }

        console.log('')
        console.log('======================================')
        console.log('ANNIVEO VIDEO COMPLETED')
        console.log('======================================')
        console.log('Task ID:', taskId)

        return res.json({
          success: true,
          message: 'Your ANNIVEO video is ready.',
          videoUrl,
          taskId,
        })
      }

      // ------------------------------------------------
      // Failed
      // ------------------------------------------------

      if (
        task.status === 'FAILED' ||
        task.status === 'CANCELED'
      ) {
        console.error('')
        console.error('GENERATION FAILED')

        console.error(
          JSON.stringify(task, null, 2)
        )

        return res.status(500).json({
          success: false,

          message:
            task.failure ||
            task.failureCode ||
            'Runway could not generate the video.',
        })
      }
    }

    // --------------------------------------------------
    // Timeout
    // --------------------------------------------------

    return res.status(504).json({
      success: false,
      message:
        'The generation is taking longer than expected.',
      taskId,
    })
  } catch (error) {
    console.error('')
    console.error('ANNIVEO SERVER ERROR')
    console.error(error?.stack || error)

    return res.status(500).json({
      success: false,

      message:
        error?.message ||
        'ANNIVEO could not generate the video.',
    })
  }
})

// --------------------------------------------------
// Start ANNIVEO backend
// --------------------------------------------------

app.listen(PORT, () => {
  console.log('')
  console.log('======================================')
  console.log('ANNIVEO BACKEND')
  console.log('======================================')
  console.log(`Running: http://localhost:${PORT}`)
  console.log('Runway connection: configured')
  console.log('======================================')
})