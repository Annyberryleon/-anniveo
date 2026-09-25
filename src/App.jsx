import { useRef, useState } from 'react'
import './App.css'

function App() {
  const [prompt, setPrompt] = useState('')
  const [ratio, setRatio] = useState('16:9')
  const [duration, setDuration] = useState('5s')

  const [isGenerating, setIsGenerating] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [videoUrl, setVideoUrl] = useState('')

  const [selectedImage, setSelectedImage] = useState(null)
  const [imagePreview, setImagePreview] = useState('')

  const fileInputRef = useRef(null)

  const openImagePicker = () => {
    fileInputRef.current?.click()
  }

  const handleImageChange = (event) => {
    const file = event.target.files?.[0]

    if (!file) {
      return
    }

    const allowedTypes = [
      'image/jpeg',
      'image/png',
      'image/webp',
    ]

    if (!allowedTypes.includes(file.type)) {
      setError(
        'Please select a JPG, PNG, or WebP image.'
      )
      return
    }

    if (file.size > 10 * 1024 * 1024) {
      setError(
        'Please select an image smaller than 10 MB.'
      )
      return
    }

    if (imagePreview) {
      URL.revokeObjectURL(imagePreview)
    }

    const previewUrl =
      URL.createObjectURL(file)

    setSelectedImage(file)
    setImagePreview(previewUrl)

    setVideoUrl('')
    setError('')
    setMessage('')
  }

  const removeImage = () => {
    if (imagePreview) {
      URL.revokeObjectURL(imagePreview)
    }

    setSelectedImage(null)
    setImagePreview('')
    setError('')
    setMessage('')

    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const generateVideo = async () => {
    if (!prompt.trim()) {
      setError(
        selectedImage
          ? 'Describe how you want the image to move.'
          : 'Please describe the video you want to create.'
      )

      setMessage('')
      return
    }

    try {
      setIsGenerating(true)
      setError('')
      setVideoUrl('')

      setMessage(
        selectedImage
          ? 'ANNIVEO is animating your image...'
          : 'ANNIVEO is creating your video...'
      )

      const formData = new FormData()

      formData.append(
        'prompt',
        prompt.trim()
      )

      formData.append(
        'ratio',
        ratio
      )

      formData.append(
        'duration',
        duration
      )

      if (selectedImage) {
        formData.append(
          'image',
          selectedImage
        )
      }

      const response = await fetch(
        'http://localhost:5000/api/generate-video',
        {
          method: 'POST',
          body: formData,
        }
      )

      const data = await response.json()

      if (!response.ok) {
        throw new Error(
          typeof data.message === 'string'
            ? data.message
            : 'Video generation failed.'
        )
      }

      if (!data.videoUrl) {
        throw new Error(
          'The video was generated, but no video URL was returned.'
        )
      }

      setVideoUrl(data.videoUrl)

      setMessage(
        data.mode === 'image-to-video'
          ? 'Your ANNIVEO image-to-video creation is ready.'
          : 'Your ANNIVEO video is ready.'
      )
    } catch (err) {
      console.error(err)

      setError(
        err.message ||
          'ANNIVEO could not generate your video.'
      )

      setMessage('')
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <div className="app">

      <header className="topbar">

        <div className="brand">
          <div className="logo-icon">
            ▶
          </div>

          <div>
            <h1>ANNIVEO</h1>
            <span>AI VIDEO STUDIO</span>
          </div>
        </div>

        <nav>

          <button
            type="button"
            className="nav-link active-nav"
          >
            Create
          </button>

          <button
            type="button"
            className="nav-link"
          >
            My Creations
          </button>

          <button
            type="button"
            className="profile"
          >
            A
          </button>

        </nav>

      </header>

      <div className="workspace">

        <aside className="sidebar">

          <button
            type="button"
            className="side-item active"
          >
            <span>✦</span>
            Generate
          </button>

          <button
            type="button"
            className="side-item"
          >
            <span>▣</span>
            Projects
          </button>

          <button
            type="button"
            className="side-item"
          >
            <span>♙</span>
            Characters
          </button>

          <button
            type="button"
            className="side-item"
          >
            <span>♫</span>
            Audio
          </button>

          <button
            type="button"
            className="side-item"
          >
            <span>⚙</span>
            Settings
          </button>

          <div className="credits">
            <span>Credits</span>
            <strong>120</strong>
          </div>

        </aside>

        <main className="main">

          <section className="creator">

            <div className="create-panel">

              <p className="eyebrow">
                AI VIDEO GENERATOR
              </p>

              <h2>
                Create your video
              </h2>

              <p className="description">
                Turn your idea or image into a
                cinematic AI-generated video.
              </p>

              <label htmlFor="videoPrompt">
                {selectedImage
                  ? 'Describe the movement'
                  : 'Describe your video'}
              </label>

              <textarea
                id="videoPrompt"
                value={prompt}
                onChange={(e) =>
                  setPrompt(
                    e.target.value
                  )
                }
                placeholder={
                  selectedImage
                    ? 'The woman slowly turns toward the camera while her hair moves gently in the breeze...'
                    : 'A woman walks through a futuristic African city at night, cinematic lighting...'
                }
              />

              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={
                  handleImageChange
                }
                style={{
                  display: 'none',
                }}
              />

              <div className="prompt-tools">

                <button
                  type="button"
                  onClick={
                    openImagePicker
                  }
                >
                  ＋{' '}
                  {selectedImage
                    ? 'Replace Image'
                    : 'Add Image'}
                </button>

                <button
                  type="button"
                >
                  ✦ Enhance Prompt
                </button>

              </div>

              {selectedImage && (

                <div
                  style={{
                    marginTop: '14px',
                    padding: '10px',
                    border:
                      '1px solid #26352f',
                    borderRadius:
                      '12px',
                    background:
                      '#101713',
                  }}
                >

                  <img
                    src={imagePreview}
                    alt="Selected reference"
                    style={{
                      display:
                        'block',
                      width: '100%',
                      maxHeight:
                        '180px',
                      objectFit:
                        'contain',
                      borderRadius:
                        '8px',
                      background:
                        '#080b09',
                    }}
                  />

                  <div
                    style={{
                      display: 'flex',
                      justifyContent:
                        'space-between',
                      alignItems:
                        'center',
                      gap: '10px',
                      marginTop:
                        '9px',
                    }}
                  >

                    <span
                      style={{
                        color:
                          '#aab5af',
                        fontSize:
                          '11px',
                        overflow:
                          'hidden',
                        textOverflow:
                          'ellipsis',
                        whiteSpace:
                          'nowrap',
                      }}
                    >
                      {
                        selectedImage.name
                      }
                    </span>

                    <button
                      type="button"
                      onClick={
                        removeImage
                      }
                    >
                      Remove
                    </button>

                  </div>

                </div>

              )}

              <div className="setting-block">

                <label>
                  Aspect Ratio
                </label>

                <div className="options">

                  {[
                    '16:9',
                    '9:16',
                  ].map(
                    (item) => (

                      <button
                        type="button"
                        key={item}
                        className={
                          ratio ===
                          item
                            ? 'selected'
                            : ''
                        }
                        onClick={() =>
                          setRatio(
                            item
                          )
                        }
                      >
                        {item}
                      </button>

                    )
                  )}

                </div>

              </div>

              <div className="setting-block">

                <label>
                  Duration
                </label>

                <div className="options">

                  {[
                    '5s',
                    '10s',
                  ].map(
                    (item) => (

                      <button
                        type="button"
                        key={item}
                        className={
                          duration ===
                          item
                            ? 'selected'
                            : ''
                        }
                        onClick={() =>
                          setDuration(
                            item
                          )
                        }
                      >
                        {item}
                      </button>

                    )
                  )}

                </div>

              </div>

              <button
                type="button"
                className="generate"
                onClick={
                  generateVideo
                }
                disabled={
                  isGenerating
                }
              >
                {isGenerating
                  ? selectedImage
                    ? '✦ Animating image...'
                    : '✦ Creating your video...'
                  : selectedImage
                    ? '✦ Generate from Image'
                    : '✦ Generate Video'}
              </button>

              <p className="cost">
                AI generation may use
                provider credits
              </p>

              {message && (

                <p
                  style={{
                    color:
                      '#28ec91',
                    textAlign:
                      'center',
                    fontSize:
                      '12px',
                    marginTop:
                      '12px',
                  }}
                >
                  {message}
                </p>

              )}

              {error && (

                <p
                  style={{
                    color:
                      '#ff6b6b',
                    textAlign:
                      'center',
                    fontSize:
                      '12px',
                    marginTop:
                      '12px',
                  }}
                >
                  {error}
                </p>

              )}

            </div>

            <div className="preview-panel">

              <div className="preview">

                {videoUrl ? (

                  <video
                    src={videoUrl}
                    controls
                    autoPlay
                    playsInline
                    style={{
                      width:
                        '100%',
                      height:
                        '100%',
                      objectFit:
                        'contain',
                      background:
                        '#000000',
                    }}
                  />

                ) : imagePreview ? (

                  <div
                    style={{
                      width:
                        '100%',
                      height:
                        '100%',
                      position:
                        'relative',
                      background:
                        '#050706',
                    }}
                  >

                    <img
                      src={
                        imagePreview
                      }
                      alt="ANNIVEO reference"
                      style={{
                        width:
                          '100%',
                        height:
                          '100%',
                        objectFit:
                          'contain',
                      }}
                    />

                    <div
                      style={{
                        position:
                          'absolute',
                        left:
                          '14px',
                        bottom:
                          '14px',
                        padding:
                          '6px 10px',
                        borderRadius:
                          '20px',
                        background:
                          'rgba(0,0,0,0.7)',
                        color:
                          '#ffffff',
                        fontSize:
                          '11px',
                      }}
                    >
                      Reference image
                    </div>

                  </div>

                ) : (

                  <div className="preview-content">

                    <div className="play">
                      {isGenerating
                        ? '✦'
                        : '▶'}
                    </div>

                    <h3>
                      {isGenerating
                        ? 'Creating your video'
                        : 'Your video will appear here'}
                    </h3>

                    <p>
                      {isGenerating
                        ? 'AI video generation can take a few minutes. Keep this page open.'
                        : 'Enter a prompt or add an image to create your first ANNIVEO video.'}
                    </p>

                  </div>

                )}

              </div>

              <div className="video-info">

                <div>

                  <span>
                    {isGenerating
                      ? 'Generating'
                      : videoUrl
                        ? 'Video ready'
                        : selectedImage
                          ? 'Image ready'
                          : 'Ready to create'}
                  </span>

                  <p>
                    {ratio} •{' '}
                    {duration}
                  </p>

                </div>

                <div className="video-actions">

                  <button
                    type="button"
                  >
                    ♡
                  </button>

                  {videoUrl && (

                    <button
                      type="button"
                      onClick={() =>
                        window.open(
                          videoUrl,
                          '_blank'
                        )
                      }
                    >
                      ↓
                    </button>

                  )}

                  <button
                    type="button"
                  >
                    ⋮
                  </button>

                </div>

              </div>

            </div>

          </section>

          <section className="creations">

            <div className="section-heading">

              <div>

                <h2>
                  My Creations
                </h2>

                <p>
                  Your recent AI
                  videos will appear
                  here.
                </p>

              </div>

              <button
                type="button"
              >
                View All
              </button>

            </div>

            {videoUrl ? (

              <div
                style={{
                  marginTop:
                    '15px',
                  maxWidth:
                    '300px',
                }}
              >

                <video
                  src={videoUrl}
                  controls
                  style={{
                    width:
                      '100%',
                    borderRadius:
                      '12px',
                    background:
                      '#000000',
                  }}
                />

                <p
                  style={{
                    color:
                      '#9aa69f',
                    fontSize:
                      '12px',
                  }}
                >
                  {prompt}
                </p>

              </div>

            ) : (

              <div className="empty-library">

                <div>
                  ▶
                </div>

                <h3>
                  No videos yet
                </h3>

                <p>
                  Your first ANNIVEO
                  creation will
                  appear here.
                </p>

              </div>

            )}

          </section>

        </main>

      </div>

    </div>
  )
}

export default App