// frontend/src/hooks/useSEO.jsx
import { Helmet } from 'react-helmet-async'

const BASE_URL       = 'https://chess-lens.pages.dev'
const DEFAULT_OG_IMG = `${BASE_URL}/og-default.png`

export function SEO({
  title,
  description,
  canonical,
  ogImage = DEFAULT_OG_IMG,
  noindex = false,
  jsonLd  = null,
}) {
  const fullTitle = title
    ? `${title} — ChessLens`
    : 'ChessLens — AI Chess Analysis'

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      {canonical && <link rel="canonical" href={`${BASE_URL}${canonical}`} />}
      {noindex && <meta name="robots" content="noindex, nofollow" />}

      {/* Open Graph */}
      <meta property="og:type"        content="website" />
      <meta property="og:site_name"   content="ChessLens" />
      <meta property="og:title"       content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:image"       content={ogImage} />
      <meta property="og:url"         content={`${BASE_URL}${canonical || ''}`} />

      {/* Twitter Card */}
      <meta name="twitter:card"        content="summary_large_image" />
      <meta name="twitter:title"       content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image"       content={ogImage} />

      {/* Structured data */}
      {jsonLd && (
        <script type="application/ld+json">
          {JSON.stringify(jsonLd)}
        </script>
      )}
    </Helmet>
  )
}