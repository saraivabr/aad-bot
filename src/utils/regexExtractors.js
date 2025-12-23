/**
 * REGEX EXTRACTORS
 * 
 * Utility functions for extracting structured data from text using regex patterns
 */

/**
 * Extract name from text
 * @param {string} text - Text to extract from
 * @returns {string|null} - Extracted name or null
 */
function extractName(text) {
  if (!text) return null;

  // Patterns for name extraction
  const patterns = [
    /(?:me chamo|meu nome é|sou o|sou a|pode me chamar de)\s+([A-ZÀ-Ú][a-zà-ú]+(?:\s+[A-ZÀ-Ú][a-zà-ú]+)*)/i,
    /^([A-ZÀ-Ú][a-zà-ú]+(?:\s+[A-ZÀ-Ú][a-zà-ú]+)*),?\s+(?:aqui|tudo bem)/i,
    /(?:é|sou)\s+([A-ZÀ-Ú][a-zà-ú]+)\s+(?:mesmo|aqui)/i
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      return match[1].trim();
    }
  }

  return null;
}

/**
 * Extract business name from text
 * @param {string} text - Text to extract from
 * @returns {string|null} - Extracted business name or null
 */
function extractBusinessName(text) {
  if (!text) return null;

  const patterns = [
    /(?:meu negócio|minha empresa|trabalho na|trabalho no|tenho (?:uma|um))\s+(?:chamad[oa]|de nome)?\s*([A-ZÀ-Ú][^\s,.!?]+(?:\s+[A-ZÀ-Ú][^\s,.!?]+)*)/i,
    /(?:empresa|negócio)\s+([A-ZÀ-Ú][^\s,.!?]+(?:\s+[A-ZÀ-Ú][^\s,.!?]+)*)/i,
    /chamad[oa]\s+([A-ZÀ-Ú][^\s,.!?]+(?:\s+[A-ZÀ-Ú][^\s,.!?]+)*)/i
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      return match[1].trim();
    }
  }

  return null;
}

/**
 * Extract location from text
 * @param {string} text - Text to extract from
 * @returns {string|null} - Extracted location or null
 */
function extractLocation(text) {
  if (!text) return null;

  const patterns = [
    /(?:em|de|localizado em|fica em|estou em|moro em|na cidade de)\s+([A-ZÀ-Ú][a-zà-ú]+(?:\s+[A-ZÀ-Ú][a-zà-ú]+)*(?:\s*,\s*[A-Z]{2})?)/i,
    /([A-ZÀ-Ú][a-zà-ú]+\s*,\s*[A-Z]{2})\b/,
    /\b(SP|RJ|MG|RS|PR|SC|BA|PE|CE|PA|AM|MA|GO|ES|PB|RN|AL|SE|PI|RO|AC|AP|RR|TO|DF)\b/
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      return match[1].trim();
    }
  }

  return null;
}

/**
 * Extract niche/industry from text
 * @param {string} text - Text to extract from
 * @returns {string|null} - Extracted niche or null
 */
function extractNiche(text) {
  if (!text) return null;

  // Common business types
  const niches = [
    'restaurante', 'lanchonete', 'padaria', 'cafeteria',
    'consultoria', 'advocacia', 'contabilidade',
    'dentista', 'clínica', 'médico', 'fisioterapia',
    'academia', 'personal', 'nutrição',
    'salão', 'barbearia', 'estética', 'beleza',
    'loja', 'comércio', 'varejo', 'e-commerce',
    'marketing', 'agência', 'designer',
    'construção', 'arquitetura', 'engenharia',
    'educação', 'escola', 'curso',
    'tecnologia', 'software', 'desenvolvimento',
    'lavanderia', 'limpeza', 'manutenção'
  ];

  const lowerText = text.toLowerCase();

  for (const niche of niches) {
    if (lowerText.includes(niche)) {
      return niche.charAt(0).toUpperCase() + niche.slice(1);
    }
  }

  // Pattern-based extraction as fallback
  const patterns = [
    /(?:trabalho com|atuo com|sou)\s+([a-zà-ú]+(?:\s+[a-zà-ú]+){0,2})/i,
    /(?:área de|segmento de|ramo de)\s+([a-zà-ú]+(?:\s+[a-zà-ú]+){0,2})/i
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      return match[1].trim().charAt(0).toUpperCase() + match[1].trim().slice(1);
    }
  }

  return null;
}

/**
 * Extract email from text
 * @param {string} text - Text to extract from
 * @returns {string|null} - Extracted email or null
 */
function extractEmail(text) {
  if (!text) return null;

  const pattern = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/;
  const match = text.match(pattern);
  
  return match ? match[0] : null;
}

/**
 * Extract phone number from text (Brazilian format)
 * @param {string} text - Text to extract from
 * @returns {string|null} - Extracted phone or null
 */
function extractPhone(text) {
  if (!text) return null;

  // Brazilian phone patterns
  const patterns = [
    /\(?\d{2}\)?\s*9?\s*\d{4}[-\s]?\d{4}/,
    /\d{11}/
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return match[0].replace(/\D/g, ''); // Return only digits
    }
  }

  return null;
}

/**
 * Extract all client data from text
 * @param {string} text - Text to extract from
 * @returns {object} - Extracted data
 */
function extractClientData(text) {
  if (!text) return {};

  return {
    name: extractName(text),
    businessName: extractBusinessName(text),
    location: extractLocation(text),
    niche: extractNiche(text),
    email: extractEmail(text),
    phone: extractPhone(text)
  };
}

/**
 * Extract URLs from text
 * @param {string} text - Text to extract from
 * @returns {string[]} - Array of URLs
 */
function extractUrls(text) {
  if (!text) return [];

  const pattern = /https?:\/\/[^\s]+/g;
  const matches = text.match(pattern);
  
  return matches || [];
}

/**
 * Extract hashtags from text
 * @param {string} text - Text to extract from
 * @returns {string[]} - Array of hashtags
 */
function extractHashtags(text) {
  if (!text) return [];

  const pattern = /#[a-zA-Z0-9_]+/g;
  const matches = text.match(pattern);
  
  return matches || [];
}

module.exports = {
  extractName,
  extractBusinessName,
  extractLocation,
  extractNiche,
  extractEmail,
  extractPhone,
  extractClientData,
  extractUrls,
  extractHashtags
};
