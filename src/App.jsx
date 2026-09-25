import { useState } from 'react'
import './App.css'

function App() {
  const [prompt, setPrompt] = useState('')
  const [ratio, setRatio] = useState('16:9')
  const [duration, setDuration] = useState('5s')

  const [isGenerating, setIsGenerating] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [videoUrl, setVideoUrl] = useState('')

  const generateVideo = async () => {
    if (!prompt.trim()) {
      setError('Please describe the video you want to create.')
      setMessage('')
      return
    }

    try {
      setIsGenerating(true)
      setError('')
      setMessage('ANNIVEO is creating your video...')
      setVideoUrl('')

      const response = await fetch(
        'http://localhost:5000/api/generate-video',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            prompt,
            ratio,
            duration,
          }),
        }
      )

      const data = await response.json()

      if (!response.ok) {
        throw new Error(
          data.message || 'Video generation failed.'
        )
      }

      if (!data.videoUrl) {
        throw new Error(
          'The video was generated, but no video URL was returned.'
        )
      }

      setVideoUrl(data.videoUrl)
      setMessage('Your ANNIVEO video is ready.')
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
          <div className="logo-icon">▶</div>

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

              <h2>Create your video</h2>

              <p className="description">
                Turn your idea into a cinematic
                AI-generated video.
              </p>

              <label htmlFor="videoPrompt">
                Describe your video
              </label>

              <textarea
                id="videoPrompt"
                value={prompt}
                onChange={(e) =>
                  setPrompt(e.target.value)
                }
                placeholder="A woman walks through a futuristic African city at night, cinematic lighting..."
              />

              <div className="prompt-tools">

                <button type="button">
                  ＋ Add Image
                </button>

                <button type="button">
                  ✦ Enhance Prompt
                </button>

              </div>

              <div className="setting-block">

                <label>Aspect Ratio</label>

                <div className="options">

                  {['16:9', '9:16'].map((item) => (
                    <button
                      type="button"
                      key={item}
                      className={
                        ratio === item
                          ? 'selected'
                          : ''
                      }
                      onClick={() =>
                        setRatio(item)
                      }
                    >
                      {item}
                    </button>
                  ))}

                </div>
              </div>

              <div className="setting-block">

                <label>Duration</label>

                <div className="options">

                  {['5s', '10s'].map((item) => (
                    <button
                      type="button"
                      key={item}
                      className={
                        duration === item
                          ? 'selected'
                          : ''
                      }
                      onClick={() =>
                        setDuration(item)
                      }
                    >
                      {item}
                    </button>
                  ))}

                </div>
              </div>

              <button
                type="button"
                className="generate"
                onClick={generateVideo}
                disabled={isGenerating}
              >
                {isGenerating
                  ? '✦ Creating your video...'
                  : '✦ Generate Video'}
              </button>

              <p className="cost">
                AI generation may use provider credits
              </p>

              {message && (
                <p
                  style={{
                    color: '#28ec91',
                    textAlign: 'center',
                    fontSize: '12px',
                    marginTop: '12px',
                  }}
                >
                  {message}
                </p>
              )}

              {error && (
                <p
                  style={{
                    color: '#ff6b6b',
                    textAlign: 'center',
                    fontSize: '12px',
                    marginTop: '12px',
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
                      width: '100%',
                      height: '100%',
                      objectFit: 'contain',
                      background: '#000000',
                    }}
                  />

                ) : (

                  <div className="preview-content">

                    <div className="play">
                      {isGenerating ? '✦' : '▶'}
                    </div>

                    <h3>
                      {isGenerating
                        ? 'Creating your video'
                        : 'Your video will appear here'}
                    </h3>

                    <p>
                      {isGenerating
                        ? 'AI video generation can take a few minutes. Keep this page open.'
                        : 'Enter a prompt and generate your first ANNIVEO video.'}
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
                        : 'Ready to create'}
                  </span>

                  <p>
                    {ratio} • {duration}
                  </p>

                </div>

                <div className="video-actions">

                  <button type="button">
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

                  <button type="button">
                    ⋮
                  </button>

                </div>

              </div>

            </div>

          </section>

          <section className="creations">

            <div className="section-heading">

              <div>

                <h2>My Creations</h2>

                <p>
                  Your recent AI videos will
                  appear here.
                </p>

              </div>

              <button type="button">
                View All
              </button>

            </div>

            {videoUrl ? (

              <div
                style={{
                  marginTop: '15px',
                  maxWidth: '300px',
                }}
              >
                <video
                  src={videoUrl}
                  controls
                  style={{
                    width: '100%',
                    borderRadius: '12px',
                    background: '#000000',
                  }}
                />

                <p
                  style={{
                    color: '#9aa69f',
                    fontSize: '12px',
                  }}
                >
                  {prompt}
                </p>
              </div>

            ) : (

              <div className="empty-library">

                <div>▶</div>

                <h3>No videos yet</h3>

                <p>
                  Your first ANNIVEO creation
                  will appear here.
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