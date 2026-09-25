import { useEffect, useRef, useState } from 'react'
import './App.css'

function App() {
  const [page, setPage] = useState('generate')

  const [prompt, setPrompt] = useState('')
  const [ratio, setRatio] = useState('16:9')
  const [duration, setDuration] = useState('5s')

  const [isGenerating, setIsGenerating] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [videoUrl, setVideoUrl] = useState('')

  const [selectedImage, setSelectedImage] = useState(null)
  const [imagePreview, setImagePreview] = useState('')

  const [characters, setCharacters] = useState([])
  const [characterName, setCharacterName] = useState('')
  const [characterImage, setCharacterImage] = useState('')
  const [selectedCharacter, setSelectedCharacter] = useState(null)

  const fileInputRef = useRef(null)
  const characterInputRef = useRef(null)

  useEffect(() => {
    try {
      const savedCharacters = JSON.parse(
        localStorage.getItem('anniveo-characters') || '[]'
      )

      setCharacters(savedCharacters)
    } catch {
      setCharacters([])
    }
  }, [])

  const saveCharacters = (items) => {
    setCharacters(items)

    localStorage.setItem(
      'anniveo-characters',
      JSON.stringify(items)
    )
  }

  const openImagePicker = () => {
    fileInputRef.current?.click()
  }

  const handleImageChange = (event) => {
    const file = event.target.files?.[0]

    if (!file) return

    const allowedTypes = [
      'image/jpeg',
      'image/png',
      'image/webp',
    ]

    if (!allowedTypes.includes(file.type)) {
      setError('Please select a JPG, PNG, or WebP image.')
      return
    }

    if (file.size > 10 * 1024 * 1024) {
      setError('Please select an image smaller than 10 MB.')
      return
    }

    if (imagePreview?.startsWith('blob:')) {
      URL.revokeObjectURL(imagePreview)
    }

    const previewUrl = URL.createObjectURL(file)

    setSelectedImage(file)
    setImagePreview(previewUrl)
    setVideoUrl('')
    setError('')
    setMessage('')
    setSelectedCharacter(null)
  }

  const removeImage = () => {
    if (imagePreview?.startsWith('blob:')) {
      URL.revokeObjectURL(imagePreview)
    }

    setSelectedImage(null)
    setImagePreview('')
    setSelectedCharacter(null)
    setError('')
    setMessage('')

    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleCharacterImage = (event) => {
    const file = event.target.files?.[0]

    if (!file) return

    const allowedTypes = [
      'image/jpeg',
      'image/png',
      'image/webp',
    ]

    if (!allowedTypes.includes(file.type)) {
      alert('Please select a JPG, PNG, or WebP image.')
      return
    }

    if (file.size > 3 * 1024 * 1024) {
      alert(
        'For saved characters, please use an image smaller than 3 MB.'
      )
      return
    }

    const reader = new FileReader()

    reader.onload = () => {
      setCharacterImage(reader.result)
    }

    reader.readAsDataURL(file)
  }

  const createCharacter = () => {
    if (!characterName.trim()) {
      alert('Please enter a character name.')
      return
    }

    if (!characterImage) {
      alert('Please add a reference image.')
      return
    }

    const newCharacter = {
      id: Date.now(),
      name: characterName.trim(),
      image: characterImage,
    }

    const updatedCharacters = [
      newCharacter,
      ...characters,
    ]

    try {
      saveCharacters(updatedCharacters)

      setCharacterName('')
      setCharacterImage('')

      if (characterInputRef.current) {
        characterInputRef.current.value = ''
      }
    } catch {
      alert(
        'The character could not be saved. Try using a smaller reference image.'
      )
    }
  }

  const deleteCharacter = (id) => {
    const updatedCharacters = characters.filter(
      (character) => character.id !== id
    )

    saveCharacters(updatedCharacters)

    if (selectedCharacter?.id === id) {
      setSelectedCharacter(null)
      setSelectedImage(null)
      setImagePreview('')
    }
  }

  const useCharacter = async (character) => {
    try {
      const response = await fetch(character.image)
      const blob = await response.blob()

      const extension =
        blob.type === 'image/png'
          ? 'png'
          : blob.type === 'image/webp'
            ? 'webp'
            : 'jpg'

      const file = new File(
        [blob],
        `${character.name}.${extension}`,
        {
          type: blob.type || 'image/jpeg',
        }
      )

      setSelectedCharacter(character)
      setSelectedImage(file)
      setImagePreview(character.image)

      setPrompt('')
      setVideoUrl('')
      setError('')
      setMessage('')

      setPage('generate')
    } catch (err) {
      console.error(err)

      alert(
        'ANNIVEO could not load this character.'
      )
    }
  }

  const generateVideo = async () => {
    if (!prompt.trim()) {
      setError(
        selectedImage
          ? 'Describe how you want the image or character to move.'
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

      formData.append('prompt', prompt.trim())
      formData.append('ratio', ratio)
      formData.append('duration', duration)

      if (selectedImage) {
        formData.append('image', selectedImage)
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

  const Sidebar = () => (
    <aside className="sidebar">
      <button
        type="button"
        className={`side-item ${
          page === 'generate' ? 'active' : ''
        }`}
        onClick={() => setPage('generate')}
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
        className={`side-item ${
          page === 'characters' ? 'active' : ''
        }`}
        onClick={() => setPage('characters')}
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
  )

  const GeneratePage = () => (
    <main className="main">
      <section className="creator">
        <div className="create-panel">
          <p className="eyebrow">
            AI VIDEO GENERATOR
          </p>

          <h2>Create your video</h2>

          <p className="description">
            Turn your idea, image, or saved character into
            an AI-generated video.
          </p>

          {selectedCharacter && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '10px',
                marginBottom: '14px',
                border: '1px solid #26352f',
                borderRadius: '12px',
                background: '#101713',
              }}
            >
              <img
                src={selectedCharacter.image}
                alt={selectedCharacter.name}
                style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '50%',
                  objectFit: 'cover',
                }}
              />

              <div>
                <div
                  style={{
                    color: '#ffffff',
                    fontWeight: '600',
                  }}
                >
                  {selectedCharacter.name}
                </div>

                <div
                  style={{
                    color: '#28ec91',
                    fontSize: '11px',
                  }}
                >
                  Character selected
                </div>
              </div>
            </div>
          )}

          <label htmlFor="videoPrompt">
            {selectedImage
              ? 'Describe the movement'
              : 'Describe your video'}
          </label>

          <textarea
            id="videoPrompt"
            value={prompt}
            onChange={(event) =>
              setPrompt(event.target.value)
            }
            placeholder={
              selectedImage
                ? 'The character looks toward the camera and moves naturally...'
                : 'A woman walks through a futuristic African city at night...'
            }
          />

          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleImageChange}
            style={{ display: 'none' }}
          />

          <div className="prompt-tools">
            <button
              type="button"
              onClick={openImagePicker}
            >
              ＋{' '}
              {selectedImage
                ? 'Replace Image'
                : 'Add Image'}
            </button>

            <button type="button">
              ✦ Enhance Prompt
            </button>
          </div>

          {selectedImage && (
            <div
              style={{
                marginTop: '14px',
                padding: '10px',
                border: '1px solid #26352f',
                borderRadius: '12px',
                background: '#101713',
              }}
            >
              <img
                src={imagePreview}
                alt="Selected reference"
                style={{
                  display: 'block',
                  width: '100%',
                  maxHeight: '180px',
                  objectFit: 'contain',
                  borderRadius: '8px',
                  background: '#080b09',
                }}
              />

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '10px',
                  marginTop: '9px',
                }}
              >
                <span
                  style={{
                    color: '#aab5af',
                    fontSize: '11px',
                  }}
                >
                  {selectedCharacter
                    ? selectedCharacter.name
                    : selectedImage.name}
                </span>

                <button
                  type="button"
                  onClick={removeImage}
                >
                  Remove
                </button>
              </div>
            </div>
          )}

          <div className="setting-block">
            <label>Aspect Ratio</label>

            <div className="options">
              {['16:9', '9:16'].map((item) => (
                <button
                  type="button"
                  key={item}
                  className={
                    ratio === item ? 'selected' : ''
                  }
                  onClick={() => setRatio(item)}
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
                  onClick={() => setDuration(item)}
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
              : selectedCharacter
                ? `✦ Generate with ${selectedCharacter.name}`
                : selectedImage
                  ? '✦ Generate from Image'
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
            ) : imagePreview ? (
              <img
                src={imagePreview}
                alt="Reference"
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'contain',
                  background: '#050706',
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
                  Enter a prompt, add an image, or choose a
                  saved character.
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
                    : selectedCharacter
                      ? `${selectedCharacter.name} ready`
                      : selectedImage
                        ? 'Image ready'
                        : 'Ready to create'}
              </span>

              <p>
                {ratio} • {duration}
              </p>
            </div>

            <div className="video-actions">
              <button type="button">♡</button>

              {videoUrl && (
                <button
                  type="button"
                  onClick={() =>
                    window.open(videoUrl, '_blank')
                  }
                >
                  ↓
                </button>
              )}

              <button type="button">⋮</button>
            </div>
          </div>
        </div>
      </section>

      <section className="creations">
        <div className="section-heading">
          <div>
            <h2>My Creations</h2>
            <p>Your recent AI videos will appear here.</p>
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
              Your first ANNIVEO creation will appear here.
            </p>
          </div>
        )}
      </section>
    </main>
  )

  const CharactersPage = () => (
    <main className="main">
      <section
        style={{
          maxWidth: '1100px',
          margin: '0 auto',
        }}
      >
        <div className="section-heading">
          <div>
            <p className="eyebrow">
              ANNIVEO CHARACTERS
            </p>

            <h2>Characters</h2>

            <p>
              Save reference characters and reuse them in
              your videos.
            </p>
          </div>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns:
              'minmax(280px, 360px) 1fr',
            gap: '24px',
            marginTop: '25px',
          }}
        >
          <div className="create-panel">
            <h2>Create Character</h2>

            <p className="description">
              Add a clear reference image and give your
              character a name.
            </p>

            <label htmlFor="characterName">
              Character name
            </label>

            <input
              id="characterName"
              type="text"
              value={characterName}
              onChange={(event) =>
                setCharacterName(event.target.value)
              }
              placeholder="Example: Amara"
              style={{
                width: '100%',
                boxSizing: 'border-box',
                padding: '12px',
                marginTop: '7px',
                marginBottom: '16px',
                borderRadius: '10px',
                border: '1px solid #26352f',
                background: '#0b110e',
                color: '#ffffff',
              }}
            />

            <input
              ref={characterInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleCharacterImage}
              style={{ display: 'none' }}
            />

            <button
              type="button"
              onClick={() =>
                characterInputRef.current?.click()
              }
              style={{
                width: '100%',
                padding: '12px',
                cursor: 'pointer',
              }}
            >
              ＋ Add Reference Image
            </button>

            {characterImage && (
              <img
                src={characterImage}
                alt="Character reference"
                style={{
                  width: '100%',
                  maxHeight: '280px',
                  objectFit: 'contain',
                  marginTop: '15px',
                  borderRadius: '12px',
                  background: '#080b09',
                }}
              />
            )}

            <button
              type="button"
              className="generate"
              onClick={createCharacter}
              style={{
                marginTop: '18px',
              }}
            >
              Save Character
            </button>
          </div>

          <div>
            <h2
              style={{
                color: '#ffffff',
                marginTop: '0',
              }}
            >
              Saved Characters
            </h2>

            {characters.length === 0 ? (
              <div className="empty-library">
                <div>♙</div>

                <h3>No characters yet</h3>

                <p>
                  Create your first reusable ANNIVEO
                  character.
                </p>
              </div>
            ) : (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns:
                    'repeat(auto-fill, minmax(180px, 1fr))',
                  gap: '16px',
                }}
              >
                {characters.map((character) => (
                  <div
                    key={character.id}
                    style={{
                      padding: '12px',
                      border: '1px solid #26352f',
                      borderRadius: '14px',
                      background: '#101713',
                    }}
                  >
                    <img
                      src={character.image}
                      alt={character.name}
                      style={{
                        width: '100%',
                        height: '180px',
                        objectFit: 'cover',
                        borderRadius: '10px',
                      }}
                    />

                    <h3
                      style={{
                        color: '#ffffff',
                        marginBottom: '5px',
                      }}
                    >
                      {character.name}
                    </h3>

                    <p
                      style={{
                        color: '#28ec91',
                        fontSize: '11px',
                      }}
                    >
                      Reference saved
                    </p>

                    <button
                      type="button"
                      className="generate"
                      onClick={() =>
                        useCharacter(character)
                      }
                    >
                      Use Character
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        deleteCharacter(character.id)
                      }
                      style={{
                        width: '100%',
                        marginTop: '8px',
                        cursor: 'pointer',
                      }}
                    >
                      Delete
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>
    </main>
  )

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
            className={`nav-link ${
              page === 'generate' ? 'active-nav' : ''
            }`}
            onClick={() => setPage('generate')}
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
        <Sidebar />

        {page === 'characters'
          ? <CharactersPage />
          : <GeneratePage />}
      </div>
    </div>
  )
}

export default App