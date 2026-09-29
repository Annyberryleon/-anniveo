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
  const [characterImages, setCharacterImages] = useState([])
  const [selectedCharacter, setSelectedCharacter] = useState(null)

  const [creations, setCreations] = useState([])

  const fileInputRef = useRef(null)
  const characterInputRef = useRef(null)

  useEffect(() => {
    try {
      const savedCharacters = JSON.parse(
        localStorage.getItem('anniveo-characters') || '[]'
      )

      const upgradedCharacters = savedCharacters.map((character) => {
        if (
          Array.isArray(character.images) &&
          character.images.length > 0
        ) {
          return character
        }

        if (character.image) {
          return {
            ...character,
            images: [character.image],
          }
        }

        return {
          ...character,
          images: [],
        }
      })

      setCharacters(upgradedCharacters)

      localStorage.setItem(
        'anniveo-characters',
        JSON.stringify(upgradedCharacters)
      )
    } catch {
      setCharacters([])
    }
  }, [])

  useEffect(() => {
    try {
      const savedCreations = JSON.parse(
        localStorage.getItem('anniveo-creations') || '[]'
      )

      setCreations(Array.isArray(savedCreations) ? savedCreations : [])
    } catch {
      setCreations([])
    }
  }, [])

  const saveCreations = (items) => {
    setCreations(items)
    localStorage.setItem('anniveo-creations', JSON.stringify(items))
  }

  const deleteCreation = (id) => {
    const updatedCreations = creations.filter(
      (creation) => creation.id !== id
    )

    saveCreations(updatedCreations)
  }

  const saveCharacters = (items) => {
    setCharacters(items)

    localStorage.setItem(
      'anniveo-characters',
      JSON.stringify(items)
    )
  }

  const getCharacterImages = (character) => {
    if (
      Array.isArray(character?.images) &&
      character.images.length > 0
    ) {
      return character.images
    }

    if (character?.image) {
      return [character.image]
    }

    return []
  }

  const getPrimaryCharacterImage = (character) => {
    const images = getCharacterImages(character)
    return images[0] || ''
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
    setSelectedCharacter(null)
    setVideoUrl('')
    setError('')
    setMessage('')
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
    const files = Array.from(event.target.files || [])

    if (files.length === 0) return

    const remainingSlots = 4 - characterImages.length

    if (remainingSlots <= 0) {
      alert('You can add up to 4 reference images.')
      return
    }

    const selectedFiles = files.slice(0, remainingSlots)

    const allowedTypes = [
      'image/jpeg',
      'image/png',
      'image/webp',
    ]

    const invalidFile = selectedFiles.find(
      (file) => !allowedTypes.includes(file.type)
    )

    if (invalidFile) {
      alert('Please use only JPG, PNG, or WebP images.')
      return
    }

    const oversizedFile = selectedFiles.find(
      (file) => file.size > 3 * 1024 * 1024
    )

    if (oversizedFile) {
      alert('Each reference image must be smaller than 3 MB.')
      return
    }

    Promise.all(
      selectedFiles.map(
        (file) =>
          new Promise((resolve, reject) => {
            const reader = new FileReader()

            reader.onload = () => resolve(reader.result)
            reader.onerror = reject

            reader.readAsDataURL(file)
          })
      )
    )
      .then((images) => {
        setCharacterImages((current) => [
          ...current,
          ...images,
        ])
      })
      .catch(() => {
        alert('ANNIVEO could not read one of the images.')
      })

    event.target.value = ''
  }

  const removeCharacterReference = (index) => {
    setCharacterImages((current) =>
      current.filter((_, imageIndex) => imageIndex !== index)
    )
  }

  const createCharacter = () => {
    if (!characterName.trim()) {
      alert('Please enter a character name.')
      return
    }

    if (characterImages.length === 0) {
      alert('Please add at least one reference image.')
      return
    }

    const newCharacter = {
      id: Date.now(),
      name: characterName.trim(),
      image: characterImages[0],
      images: characterImages,
    }

    const updatedCharacters = [
      newCharacter,
      ...characters,
    ]

    try {
      saveCharacters(updatedCharacters)

      setCharacterName('')
      setCharacterImages([])

      if (characterInputRef.current) {
        characterInputRef.current.value = ''
      }
    } catch {
      alert(
        'The character could not be saved. Browser storage may be full. Try smaller reference images.'
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
      const primaryImage = getPrimaryCharacterImage(character)

      if (!primaryImage) {
        throw new Error('Character has no reference image.')
      }

      const response = await fetch(primaryImage)
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
      setImagePreview(primaryImage)

      setPrompt('')
      setVideoUrl('')
      setError('')
      setMessage('')

      setPage('generate')
    } catch (err) {
      console.error(err)

      alert('ANNIVEO could not load this character.')
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

      const formData = new FormData()

      formData.append('prompt', prompt.trim())
      formData.append('ratio', ratio)
      formData.append('duration', duration)

      if (selectedCharacter) {
        const references = getCharacterImages(selectedCharacter)

        setMessage(
          `Preparing ${references.length} references for ${selectedCharacter.name}...`
        )

        formData.append('characterName', selectedCharacter.name)
        formData.append('generationMode', 'character')

        for (let index = 0; index < references.length; index++) {
          const reference = references[index]
          const response = await fetch(reference)

          if (!response.ok) {
            throw new Error(
              `Could not load reference ${index + 1}.`
            )
          }

          const blob = await response.blob()

          const extension =
            blob.type === 'image/png'
              ? 'png'
              : blob.type === 'image/webp'
                ? 'webp'
                : 'jpg'

          const referenceFile = new File(
            [blob],
            `${selectedCharacter.name}-reference-${index + 1}.${extension}`,
            {
              type: blob.type || 'image/jpeg',
            }
          )

          formData.append('characterImages', referenceFile)
        }
      } else if (selectedImage) {
        setMessage('ANNIVEO is animating your image...')

        formData.append('image', selectedImage)
        formData.append('generationMode', 'image')
      } else {
        setMessage('ANNIVEO is creating your video...')
        formData.append('generationMode', 'text')
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

      if (data.mode === 'character-test') {
        setMessage(
          `${data.characterName}: backend received ${data.referenceCount} reference images successfully.`
        )
        return
      }

      if (!data.videoUrl) {
        throw new Error(
          'The video was generated, but no video URL was returned.'
        )
      }

      setVideoUrl(data.videoUrl)

      const newCreation = {
        id: Date.now(),
        videoUrl: data.videoUrl,
        prompt: prompt.trim(),
        characterName: selectedCharacter?.name || '',
        ratio,
        duration,
        mode: data.mode || (selectedCharacter ? 'character-video' : selectedImage ? 'image-to-video' : 'text-to-video'),
        createdAt: new Date().toISOString(),
      }

      try {
        saveCreations([newCreation, ...creations])
      } catch (storageError) {
        console.error('Could not save creation locally:', storageError)
      }

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
                src={getPrimaryCharacterImage(selectedCharacter)}
                alt={selectedCharacter.name}
                style={{
                  width: '48px',
                  height: '48px',
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
                  Character selected •{' '}
                  {getCharacterImages(selectedCharacter).length}{' '}
                  reference
                  {getCharacterImages(selectedCharacter).length === 1
                    ? ''
                    : 's'}
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
              selectedCharacter
                ? `Describe what ${selectedCharacter.name} should do in this scene...`
                : selectedImage
                  ? 'Describe how the subject should move...'
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
  {selectedImage ? 'Replace Image' : 'Add Image'}
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

          <button type="button" onClick={() => setPage('creations')}>
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

  const MyCreationsPage = () => (
    <main className="main">
      <section style={{ maxWidth: '1100px', margin: '0 auto' }}>
        <div className="section-heading">
          <div>
            <p className="eyebrow">ANNIVEO LIBRARY</p>
            <h2>My Creations</h2>
            <p>Your saved ANNIVEO videos appear here.</p>
          </div>
        </div>

        {creations.length === 0 ? (
          <div className="empty-library">
            <div>▶</div>
            <h3>No videos yet</h3>
            <p>Your first completed ANNIVEO video will appear here.</p>
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
              gap: '18px',
              marginTop: '24px',
            }}
          >
            {creations.map((creation) => (
              <article
                key={creation.id}
                style={{
                  padding: '12px',
                  border: '1px solid #26352f',
                  borderRadius: '14px',
                  background: '#101713',
                }}
              >
                <video
                  src={creation.videoUrl}
                  controls
                  playsInline
                  style={{
                    width: '100%',
                    aspectRatio: '16 / 9',
                    objectFit: 'contain',
                    borderRadius: '10px',
                    background: '#000000',
                  }}
                />

                <p style={{ color: '#ffffff', fontSize: '13px' }}>
                  {creation.prompt}
                </p>

                <p style={{ color: '#9aa69f', fontSize: '11px' }}>
                  {creation.characterName
                    ? `${creation.characterName} • `
                    : ''}
                  {creation.ratio} • {creation.duration} •{' '}
                  {creation.mode === 'character-video'
                    ? 'Character'
                    : creation.mode === 'image-to-video'
                      ? 'Image'
                      : 'Text'}
                </p>

                <p style={{ color: '#748079', fontSize: '10px' }}>
                  {new Date(creation.createdAt).toLocaleString()}
                </p>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => window.open(creation.videoUrl, '_blank')}
                    style={{ cursor: 'pointer' }}
                  >
                    Open Video
                  </button>

                  <button
                    type="button"
                    onClick={() => deleteCreation(creation.id)}
                    style={{ cursor: 'pointer' }}
                  >
                    Delete
                  </button>
                </div>
              </article>
            ))}
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
              Save several views of a character and reuse
              them when creating videos.
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
              Add up to four clear reference images. A
              front-facing portrait should be the first
              image.
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
              placeholder="Example: Anita"
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
              multiple
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
              ＋ Add Reference Images
            </button>

            <p
              style={{
                color: '#9aa69f',
                fontSize: '11px',
                marginTop: '8px',
              }}
            >
              {characterImages.length}/4 references selected
            </p>

            {characterImages.length > 0 && (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns:
                    'repeat(2, minmax(0, 1fr))',
                  gap: '8px',
                  marginTop: '12px',
                }}
              >
                {characterImages.map((image, index) => (
                  <div
                    key={`${image.slice(0, 30)}-${index}`}
                    style={{
                      position: 'relative',
                    }}
                  >
                    <img
                      src={image}
                      alt={`Character reference ${index + 1}`}
                      style={{
                        width: '100%',
                        height: '130px',
                        objectFit: 'cover',
                        borderRadius: '10px',
                        background: '#080b09',
                      }}
                    />

                    <button
                      type="button"
                      onClick={() =>
                        removeCharacterReference(index)
                      }
                      style={{
                        position: 'absolute',
                        top: '6px',
                        right: '6px',
                        cursor: 'pointer',
                      }}
                    >
                      ×
                    </button>

                    {index === 0 && (
                      <div
                        style={{
                          position: 'absolute',
                          left: '6px',
                          bottom: '6px',
                          padding: '4px 7px',
                          borderRadius: '10px',
                          background: 'rgba(0,0,0,0.75)',
                          color: '#ffffff',
                          fontSize: '10px',
                        }}
                      >
                        Primary
                      </div>
                    )}
                  </div>
                ))}
              </div>
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
                    'repeat(auto-fill, minmax(200px, 1fr))',
                  gap: '16px',
                }}
              >
                {characters.map((character) => {
                  const images = getCharacterImages(character)

                  return (
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
                        src={images[0]}
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
                        {images.length}{' '}
                        reference
                        {images.length === 1 ? '' : 's'} saved
                      </p>

                      {images.length > 1 && (
                        <div
                          style={{
                            display: 'flex',
                            gap: '5px',
                            marginBottom: '10px',
                          }}
                        >
                          {images.slice(1).map((image, index) => (
                            <img
                              key={`${character.id}-${index}`}
                              src={image}
                              alt=""
                              style={{
                                width: '38px',
                                height: '38px',
                                objectFit: 'cover',
                                borderRadius: '7px',
                              }}
                            />
                          ))}
                        </div>
                      )}

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
                  )
                })}
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
            className={`nav-link ${
              page === 'creations' ? 'active-nav' : ''
            }`}
            onClick={() => setPage('creations')}
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
          : page === 'creations'
            ? <MyCreationsPage />
            : <GeneratePage />}
      </div>
    </div>
  )
}

export default App
