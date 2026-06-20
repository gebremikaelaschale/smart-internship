const { similarityFromLevenshtein } = require('./internshipMatching');

const DEPARTMENT_ALIASES = {
    it: 'Information Technology',
    'i t': 'Information Technology',
    'information tech': 'Information Technology',
    'information technology': 'Information Technology',
    'information technology department': 'Information Technology',
    'it department': 'Information Technology'
};

function normalizeAcademicSpacing(value = '') {
    return String(value || '').trim().replace(/\s+/g, ' ');
}

function toTitleCase(value = '') {
    return normalizeAcademicSpacing(value)
        .split(' ')
        .filter(Boolean)
        .map((word) => {
            if (/^[A-Z0-9]{2,}$/.test(word)) return word;
            return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
        })
        .join(' ');
}

function compactAcademicText(value = '') {
    return normalizeAcademicSpacing(value)
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '');
}

function canonicalizeAcademicName(value = '') {
    const cleaned = normalizeAcademicSpacing(value);
    if (!cleaned) return '';

    const lower = cleaned.toLowerCase().replace(/[.]/g, '');
    if (DEPARTMENT_ALIASES[lower]) return DEPARTMENT_ALIASES[lower];

    return toTitleCase(cleaned);
}

function scoreAcademicMatch(left = '', right = '') {
    const source = canonicalizeAcademicName(left);
    const target = canonicalizeAcademicName(right);
    if (!source || !target) return 0;

    if (compactAcademicText(source) === compactAcademicText(target)) {
        return 1;
    }

    const directScore = similarityFromLevenshtein(source, target);
    const compactScore = similarityFromLevenshtein(compactAcademicText(source), compactAcademicText(target));
    return Math.max(directScore, compactScore);
}

function findBestAcademicMatch(input = '', candidates = [], threshold = 0.8) {
    const normalizedInput = canonicalizeAcademicName(input);
    if (!normalizedInput) return null;

    let bestMatch = null;
    for (const candidate of candidates) {
        const candidateName = canonicalizeAcademicName(candidate?.name || candidate);
        if (!candidateName) continue;

        const score = scoreAcademicMatch(normalizedInput, candidateName);
        if (!bestMatch || score > bestMatch.score) {
            bestMatch = {
                name: candidateName,
                score,
                candidate
            };
        }
    }

    if (!bestMatch || bestMatch.score < threshold) return null;
    return bestMatch;
}

function buildAcademicSuggestionList(input = '', candidates = [], limit = 3) {
    const normalizedInput = canonicalizeAcademicName(input);
    if (!normalizedInput) return [];

    return candidates
        .map((candidate) => {
            const name = canonicalizeAcademicName(candidate?.name || candidate);
            if (!name) return null;
            return {
                name,
                score: scoreAcademicMatch(normalizedInput, name),
                candidate
            };
        })
        .filter(Boolean)
        .sort((left, right) => right.score - left.score || left.name.localeCompare(right.name))
        .slice(0, limit);
}

module.exports = {
    canonicalizeAcademicName,
    compactAcademicText,
    findBestAcademicMatch,
    buildAcademicSuggestionList,
    scoreAcademicMatch
};