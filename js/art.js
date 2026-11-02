
const { useState, useEffect } = React;

function CommunityArt() {

  // React state for all form fields
  const [form, setForm] = useState({
    artistName: "",
    email: "",
    artworkTitle: "",
    category: "",
    imageUrl: "",
    visibility: "Public Gallery",
    description: "",
    permission: false
  });

  const [errors, setErrors] = useState("");
  const [message, setMessage] = useState("");
  const [jsonOutput, setJsonOutput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [gallery, setGallery] = useState([]);
  const [galleryError, setGalleryError] = useState("");

  // Load existing gallery data using jQuery AJAX
  useEffect(() => {
    let active = true;

    $.getJSON("/data/artworks.json")
      .done(function(data) {
        if (active) setGallery(data);
      })
      .fail(function() {
        if (active) {
          setGalleryError("Could not load sample artwork.");
        }
      });

    return () => { active = false; };
  }, []);

  // Update form data using React
  function handleChange(event) {
    const { name, type, checked, value } = event.target;

    setForm(previous => ({
      ...previous,
      [name]: type === "checkbox" ? checked : value
    }));
  }

  // JavaScript client-side validation
  function validateForm() {
    if (!form.artistName.trim()) {
      return "Artist name is required.";
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(form.email)) {
      return "Enter a valid email address.";
    }

    if (!form.artworkTitle.trim()) {
      return "Artwork title is required.";
    }

    if (!form.category) {
      return "Please select an art category.";
    }

    if (form.imageUrl.trim()) {
      try {
        const url = new URL(form.imageUrl);
        if (!["https:", "http:"].includes(url.protocol)) {
          return "Artwork image URL must use HTTP or HTTPS.";
        }
      } catch {
        return "Please enter a valid artwork image URL.";
      }
    }

    if (!form.permission) {
      return "You must confirm that you have permission to share this artwork.";
    }

    return "";
  }

  function handleSubmit(event) {
    event.preventDefault();

    setErrors("");
    setMessage("");

    // Step 1: Validate all user inputs
    const error = validateForm();

    if (error) {
      setErrors(error);
      return;
    }

    // Step 2: Create a JSON document
    const artworkData = {
      artistName: form.artistName.trim(),
      email: form.email.trim(),
      artworkTitle: form.artworkTitle.trim(),
      category: form.category,
      imageUrl: form.imageUrl.trim(),
      visibility: form.visibility,
      description: form.description.trim(),
      permission: form.permission,
      reviewStatus: "Pending Review",
      submittedAt: new Date().toISOString()
    };

    const json = JSON.stringify(artworkData, null, 2);

    setJsonOutput(json);
    setSubmitting(true);

    // Step 3: Submit JSON using jQuery AJAX to our RESTful API (server/api.js)
    $.ajax({
      url: "/api/artworks",
      type: "POST",
      contentType: "application/json; charset=UTF-8",
      data: JSON.stringify(artworkData),

      success: function(response) {
        // The server saved it to data/artwork-submissions.json
        setMessage(
          "Submission received! " +
          "Submission ID: " + response.id +
          ". Your artwork is " + response.reviewStatus.toLowerCase() +
          " and will appear in the gallery once approved."
        );
      },

      error: function(xhr) {
        // status 0 means the server could not be reached
        if (xhr.status === 0) {
          setErrors("Could not reach the server. Is it running (npm run dev)?");
          return;
        }
        // show the server's own validation messages when it sends them
        const body = xhr.responseJSON || {};
        const details = Object.values(body.details || {});
        setErrors(
          details.length
            ? details.join(" ")
            : "AJAX submission failed. HTTP status: " + xhr.status + "."
        );
      },

      complete: function() {
        setSubmitting(false);
      }
    });
  }

  return (
    <div>
      <div className="row g-4">

        {/* Submission Form */}
        <div className="col-lg-8">
          <section className="art-form-card">
            <h2 className="section-title">
              Submit Your Artwork
            </h2>

            <p className="text-muted">
              Fill out the form to finalize your artwork
              submission and display preferences.
            </p>

            <form onSubmit={handleSubmit} noValidate>
              <div className="row g-3">

                <div className="col-md-6">
                  <label htmlFor="artistName" className="form-label">
                    Artist Name *
                  </label>
                  <input
                    id="artistName"
                    className="form-control"
                    name="artistName"
                    value={form.artistName}
                    onChange={handleChange}
                    placeholder="Enter your name"
                  />
                </div>

                <div className="col-md-6">
                  <label htmlFor="email" className="form-label">
                    Email Address *
                  </label>
                  <input
                    id="email"
                    type="email"
                    className="form-control"
                    name="email"
                    value={form.email}
                    onChange={handleChange}
                    placeholder="you@example.com"
                  />
                </div>

                <div className="col-12">
                  <label htmlFor="artworkTitle" className="form-label">
                    Artwork Title *
                  </label>
                  <input
                    id="artworkTitle"
                    className="form-control"
                    name="artworkTitle"
                    value={form.artworkTitle}
                    onChange={handleChange}
                    placeholder="Name of your artwork"
                  />
                </div>

                <div className="col-md-6">
                  <label htmlFor="category" className="form-label">
                    Art Category *
                  </label>
                  <select
                    id="category"
                    className="form-select"
                    name="category"
                    value={form.category}
                    onChange={handleChange}
                  >
                    <option value="">Choose category</option>
                    <option value="Painting">Painting</option>
                    <option value="Drawing">Drawing</option>
                    <option value="Photography">Photography</option>
                    <option value="Digital Art">Digital Art</option>
                    <option value="Sculpture">Sculpture</option>
                  </select>
                </div>

                <div className="col-md-6">
                  <label htmlFor="visibility" className="form-label">
                    Display Preference *
                  </label>
                  <select
                    id="visibility"
                    className="form-select"
                    name="visibility"
                    value={form.visibility}
                    onChange={handleChange}
                  >
                    <option value="Public Gallery">
                      Public Gallery
                    </option>
                    <option value="Members Only">
                      Members Only
                    </option>
                    <option value="Private Review">
                      Private Review
                    </option>
                  </select>
                </div>

                <div className="col-12">
                  <label htmlFor="imageUrl" className="form-label">
                    Artwork Image URL (Optional)
                  </label>
                  <input
                    id="imageUrl"
                    type="url"
                    className="form-control"
                    name="imageUrl"
                    value={form.imageUrl}
                    onChange={handleChange}
                    placeholder="https://example.com/art.jpg"
                  />
                  <div className="form-text">
                    Provide a public image link. This demo
                    does not upload files from your computer.
                  </div>
                </div>

                <div className="col-12">
                  <label htmlFor="description" className="form-label">
                    Artwork Description
                  </label>
                  <textarea
                    id="description"
                    className="form-control"
                    name="description"
                    rows="4"
                    value={form.description}
                    onChange={handleChange}
                    placeholder="Tell us about your artwork..."
                  />
                </div>

                <div className="col-12">
                  <div className="form-check">
                    <input
                      id="permission"
                      className="form-check-input"
                      type="checkbox"
                      name="permission"
                      checked={form.permission}
                      onChange={handleChange}
                    />
                    <label htmlFor="permission" className="form-check-label">
                      I own this artwork or have permission to share it. *
                    </label>
                  </div>
                </div>

              </div>

              {/* Validation error state */}
              {errors && (
                <div className="alert alert-danger mt-3" role="alert">
                  {errors}
                </div>
              )}

              {/* Success state */}
              {message && (
                <div className="alert alert-success mt-3" role="status">
                  {message}
                </div>
              )}

              <button
                type="submit"
                className="btn art-btn mt-4"
                disabled={submitting}
              >
                {submitting
                  ? "Submitting..."
                  : "Finalize Artwork Submission"}
              </button>
            </form>
          </section>
        </div>

        {/* Instructions panel */}
        <div className="col-lg-4">
          <aside className="art-form-card">
            <h3 className="h5">How It Works</h3>
            <p>1. Enter your artist information.</p>
            <p>2. Describe your artwork.</p>
            <p>3. Choose your gallery preferences.</p>
            <p>4. Confirm you can share the art.</p>
            <p>5. Submit your preferences for review.</p>
            <hr />
            <p className="text-muted small">
              This page demonstrates form validation,
              JSON generation, React state, and AJAX
              communication with our REST API.
            </p>
          </aside>
        </div>

      </div>

      {/* JSON output for assignment evidence */}
      {jsonOutput && (
        <section className="mt-5">
          <h3>Generated JSON Document</h3>
          <p>
            The following JSON was prepared for submission:
          </p>
          <pre className="json-box">{jsonOutput}</pre>
        </section>
      )}

      {/* Gallery loaded using jQuery AJAX */}
      <section className="mt-5">
        <h2 className="section-title">Community Art Showcase</h2>
        <p className="text-muted">
          Example community artwork loaded from a JSON file.
        </p>

        {galleryError && (
          <div className="alert alert-warning">
            {galleryError}
          </div>
        )}

        <div className="row g-3">
          {gallery.map(art => (
            <div className="col-md-4" key={art.id}>
              <div className="art-gallery-card">
                <h4 className="h5">{art.title}</h4>
                <p className="art-category">{art.category}</p>
                <p><strong>Artist:</strong> {art.artist}</p>
                <p>{art.description}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

    </div>
  );
}

// Mount the React app
ReactDOM.createRoot(
  document.getElementById("art-root")
).render(<CommunityArt />);