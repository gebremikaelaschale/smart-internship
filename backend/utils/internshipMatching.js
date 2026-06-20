const natural = require('natural');

const STOP_WORDS = new Set([
    'and', 'the', 'is', 'a', 'an', 'of', 'to', 'for', 'in', 'on', 'at', 'by', 'with', 'from', 'as', 'or', 'be', 'are', 'was',
    'were', 'it', 'this', 'that', 'these', 'those', 'you', 'your', 'our', 'their', 'they', 'we', 'i', 'student', 'work'
]);

const GENERAL_TERMS = new Set([
    'student', 'students', 'internship', 'internships', 'work', 'working', 'job', 'role', 'project', 'projects', 'company',
    'team', 'teams', 'experience', 'learning', 'learn', 'learned', 'skill', 'skills', 'task', 'tasks', 'support', 'assist',
    'assistant', 'opportunity', 'opportunities', 'program', 'programs', 'department', 'office'
]);

const HIGH_VALUE_TERMS = new Set([
    'quickbooks', 'nursing', 'java', 'react', 'reactjs', 'anatomy', 'physiology', 'sql', 'database', 'databases', 'python',
    'javascript', 'typescript', 'node', 'nodejs', 'excel', 'bookkeeping', 'accounting', 'audit', 'tax', 'taxation', 'finance',
    'financial', 'biochemistry', 'pharmacy', 'clinical', 'surgery', 'medicine', 'medical', 'health', 'informatics', 'software',
    'programming', 'frontend', 'backend', 'fullstack', 'html', 'css', 'docker', 'linux', 'cloud', 'cybersecurity', 'networking',
    'hospital', 'laboratory', 'lab', 'research', 'analysis', 'data', 'analytics', 'communication', 'accountant', 'accountancy'
]);

const DEPARTMENT_KEYWORDS = {
    health: ['health', 'medical', 'medicine', 'nursing', 'pharmacy', 'clinical', 'anatomy', 'physiology', 'laboratory', 'lab', 'public health', 'midwifery'],
    informatics: ['informatics', 'computer', 'software', 'information technology', 'information systems', 'ict', 'it', 'cs', 'programming', 'web', 'react', 'node', 'database'],
    accounting: ['accounting', 'accountant', 'finance', 'financial', 'audit', 'tax', 'taxation', 'bookkeeping', 'business', 'economics', 'commerce', 'management'],
    engineering: ['engineering', 'electrical', 'mechanical', 'civil', 'industrial', 'electronics', 'construction'],
    education: ['education', 'teaching', 'pedagogy', 'curriculum']
};

const SOURCE_WEIGHTS = {
    studentSkills: 2.4,
    studentCourses: 1.5,
    studentBio: 1.0,
    studentDepartment: 1.3,
    studentProfile: 0.9,
    internshipSkills: 2.6,
    internshipRequirements: 2.1,
    internshipTitle: 1.8,
    internshipFocus: 1.4,
    internshipDescription: 1.0,
    internshipDepartment: 1.4,
    internshipMeta: 0.8
};

const COMMON_NORMALIZATIONS = {
    ract: 'react',
    reactjs: 'react',
    claude: 'cloud',
    claud: 'cloud',
    computerscience: 'computer science',
    computerengineering: 'computer engineering',
    informationtechnology: 'information technology'
};

function normalizeText(value = '') {
    let text = String(value || '')
        .normalize('NFKD')
        .toLowerCase()
        .replace(/[_-]+/g, ' ')
        .replace(/[^a-z0-9+.#\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    Object.entries(COMMON_NORMALIZATIONS).forEach(([wrong, correct]) => {
        const regex = new RegExp(`\\b${wrong}\\b`, 'g');
        text = text.replace(regex, correct);
    });

    return text;
}

function tokenizeText(value = '') {
    return normalizeText(value)
        .split(' ')
        .map((token) => token.trim())
        .filter((token) => token && !STOP_WORDS.has(token));
}

function toDocumentText(value) {
    if (Array.isArray(value)) {
        return value
            .flatMap((item) => toDocumentText(item).split(' '))
            .filter(Boolean)
            .join(' ');
    }

    if (value && typeof value === 'object') {
        return Object.values(value)
            .map((entry) => toDocumentText(entry))
            .filter(Boolean)
            .join(' ');
    }

    return String(value || '');
}

function buildStudentVectorString(profile = {}, student = {}) {
    const narrativeSkills = String(profile?.skills_description || profile?.academicInfo?.skills_description || '').trim();
    const skillEntries = Array.isArray(profile?.academicInfo?.skillEntries) ? profile.academicInfo.skillEntries : [];
    const skillEntryText = skillEntries
        .map((entry) => [entry?.skill, entry?.level, entry?.context].map((part) => String(part || '').trim()).filter(Boolean).join(' '))
        .filter(Boolean)
        .join(' ');

    return [
        narrativeSkills,
        skillEntryText,
        profile?.academicInfo?.skills,
        profile?.academicInfo?.courses,
        profile?.bio,
        profile?.personalInfo?.bio,
        profile?.personalInfo?.address,
        profile?.personalInfo?.department,
        student?.department,
        student?.college
    ]
        .map((value) => toDocumentText(value))
        .filter(Boolean)
        .join(' ');
}

function buildInternshipVectorString(internship = {}) {
    const structuredRequirements = internship?.structuredRequirements || {};
    const unifiedRequirements = String(internship?.internship_requirements || internship?.description || '').trim();
    const structuredText = [
        structuredRequirements.coreTechnicalSkills,
        structuredRequirements.preferredSkills,
        structuredRequirements.softSkills
    ]
        .map((value) => toDocumentText(value))
        .filter(Boolean)
        .join(' ');

    return [
        unifiedRequirements,
        structuredText,
        internship?.requiredSkills,
        internship?.requirements,
        internship?.title,
        internship?.trainingFocus,
        internship?.description,
        internship?.department,
        internship?.targetDepartments,
        internship?.location,
        internship?.companyName
    ]
        .map((value) => toDocumentText(value))
        .filter(Boolean)
        .join(' ');
}

function uniqueTokens(tokens = []) {
    return [...new Set((Array.isArray(tokens) ? tokens : []).filter(Boolean))];
}

function extractCharacterNgrams(value = '', minSize = 2, maxSize = 4) {
    const compact = normalizeText(value).replace(/\s+/g, '');
    if (!compact) return [];

    const grams = [];
    for (let size = minSize; size <= Math.min(maxSize, compact.length); size += 1) {
        if (compact.length <= size) {
            grams.push(compact);
            continue;
        }

        for (let index = 0; index <= compact.length - size; index += 1) {
            grams.push(compact.slice(index, index + size));
        }
    }

    return grams;
}

function getTokenImportance(token = '') {
    const value = normalizeText(token);
    if (!value || STOP_WORDS.has(value)) return 0;
    if (HIGH_VALUE_TERMS.has(value)) return 1.8;
    if (GENERAL_TERMS.has(value)) return 0.45;
    if (/[0-9+#.]/.test(value)) return 1.25;
    if (value.length >= 10) return 1.15;
    if (value.length >= 7) return 1.05;
    return 1;
}

function lemmaToken(token = '') {
    const normalized = normalizeText(token);
    if (!normalized || STOP_WORDS.has(normalized)) return '';

    const aliasMap = {
        accountant: 'account',
        accounting: 'account',
        accountancy: 'account',
        accounts: 'account',
        account: 'account',
        ract: 'react',
        informatics: 'informatics',
        informat: 'informatics',
        developer: 'developer',
        develop: 'developer',
        databases: 'database',
        database: 'database',
        reactjs: 'react',
        react: 'react',
        frontend: 'frontend',
        front: 'frontend',
        backend: 'backend',
        back: 'backend',
        nodejs: 'node',
        node: 'node',
        js: 'javascript',
        javascript: 'javascript',
        typescript: 'typescript',
        computer: 'computer',
        management: 'management'
    };

    if (aliasMap[normalized]) return aliasMap[normalized];

    const stemmed = natural.PorterStemmer.stem(normalized);
    if (!stemmed || STOP_WORDS.has(stemmed)) return '';
    return aliasMap[stemmed] || stemmed;
}

function resolveDepartmentKey(value = '') {
    const normalized = normalizeText(value);
    if (!normalized) return '';

    for (const [departmentKey, keywords] of Object.entries(DEPARTMENT_KEYWORDS)) {
        if (keywords.some((keyword) => normalized === keyword || normalized.includes(keyword) || keyword.includes(normalized))) {
            return departmentKey;
        }
    }

    return normalized;
}

function isDepartmentCompatible(studentDepartment = '', internshipDepartment = '', targetDepartments = []) {
    const studentKey = resolveDepartmentKey(studentDepartment);
    const internshipKey = resolveDepartmentKey(internshipDepartment);
    const targetKeys = uniqueTokens((Array.isArray(targetDepartments) ? targetDepartments : []).map((value) => resolveDepartmentKey(value)));

    if (!studentKey) return true;

    if (internshipKey) {
        return studentKey === internshipKey;
    }

    if (targetKeys.length > 0) {
        return targetKeys.some((key) => key === studentKey);
    }

    return false;
}

function collectStudentSegments(profile = {}, student = {}) {
    return [
        { value: profile?.skills_description || profile?.academicInfo?.skills_description, weight: 4.8, source: 'skills_description' },
        { value: buildStudentVectorString(profile, student), weight: 3.6, source: 'vector' },
        { value: profile?.academicInfo?.skills, weight: SOURCE_WEIGHTS.studentSkills, source: 'skills' },
        { value: profile?.skills, weight: SOURCE_WEIGHTS.studentSkills, source: 'skills' },
        { value: profile?.studentSkills, weight: SOURCE_WEIGHTS.studentSkills, source: 'skills' },
        { value: profile?.student_skills, weight: SOURCE_WEIGHTS.studentSkills, source: 'skills' },
        { value: profile?.academicInfo?.skillEntries, weight: SOURCE_WEIGHTS.studentSkills, source: 'skills' },
        { value: profile?.academicInfo?.courses, weight: SOURCE_WEIGHTS.studentCourses, source: 'courses' },
        { value: profile?.bio, weight: SOURCE_WEIGHTS.studentBio, source: 'bio' },
        { value: profile?.personalInfo?.bio, weight: SOURCE_WEIGHTS.studentBio, source: 'bio' },
        { value: profile?.personalInfo?.address, weight: SOURCE_WEIGHTS.studentProfile, source: 'profile' },
        { value: profile?.personalInfo?.department, weight: SOURCE_WEIGHTS.studentDepartment, source: 'department' },
        { value: student?.department, weight: SOURCE_WEIGHTS.studentDepartment, source: 'department' },
        { value: student?.college, weight: SOURCE_WEIGHTS.studentProfile, source: 'profile' }
    ]
        .map((segment) => ({
            ...segment,
            text: toDocumentText(segment.value)
        }))
        .filter((segment) => Boolean(segment.text));
}

function collectInternshipSegments(internship = {}) {
    return [
        { value: internship?.internship_requirements || internship?.description, weight: 4.9, source: 'internship_requirements' },
        { value: buildInternshipVectorString(internship), weight: 3.8, source: 'vector' },
        { value: internship?.requiredSkills, weight: SOURCE_WEIGHTS.internshipSkills, source: 'skills' },
        { value: internship?.required_skills, weight: SOURCE_WEIGHTS.internshipSkills, source: 'skills' },
        { value: internship?.structuredRequirements?.coreTechnicalSkills, weight: SOURCE_WEIGHTS.internshipSkills, source: 'skills' },
        { value: internship?.structuredRequirements?.preferredSkills, weight: SOURCE_WEIGHTS.internshipFocus, source: 'focus' },
        { value: internship?.structuredRequirements?.softSkills, weight: SOURCE_WEIGHTS.internshipFocus, source: 'focus' },
        { value: internship?.requirements, weight: SOURCE_WEIGHTS.internshipRequirements, source: 'requirements' },
        { value: internship?.title, weight: SOURCE_WEIGHTS.internshipTitle, source: 'title' },
        { value: internship?.trainingFocus, weight: SOURCE_WEIGHTS.internshipFocus, source: 'focus' },
        { value: internship?.description, weight: SOURCE_WEIGHTS.internshipDescription, source: 'description' },
        { value: internship?.department, weight: SOURCE_WEIGHTS.internshipDepartment, source: 'department' },
        { value: internship?.targetDepartments, weight: SOURCE_WEIGHTS.internshipDepartment, source: 'department' },
        { value: internship?.location, weight: SOURCE_WEIGHTS.internshipMeta, source: 'meta' },
        { value: internship?.companyName, weight: SOURCE_WEIGHTS.internshipMeta, source: 'meta' }
    ]
        .map((segment) => ({
            ...segment,
            text: toDocumentText(segment.value)
        }))
        .filter((segment) => Boolean(segment.text));
}

function buildWeightedFeatureMap(segments = []) {
    const map = new Map();
    let totalWeight = 0;

    segments.forEach((segment) => {
        const tokens = tokenizeText(segment.text);
        if (tokens.length === 0) return;

        const sourceWeight = Number(segment.weight || 1);
        const tokenWeight = sourceWeight / tokens.length;

        tokens.forEach((token) => {
            const canonical = lemmaToken(token);
            if (!canonical) return;

            const importance = getTokenImportance(canonical) * tokenWeight;
            if (importance <= 0) return;

            const lemmaKey = `lemma:${canonical}`;
            map.set(lemmaKey, (map.get(lemmaKey) || 0) + importance * 1.25);
            totalWeight += importance * 1.25;

            const grams = extractCharacterNgrams(canonical, 2, 4);
            if (grams.length > 0) {
                const gramWeight = importance * 0.8 / grams.length;
                grams.forEach((gram) => {
                    const gramKey = `ng:${gram}`;
                    map.set(gramKey, (map.get(gramKey) || 0) + gramWeight);
                    totalWeight += gramWeight;
                });
            }
        });
    });

    return { map, totalWeight: totalWeight || 1 };
}

function buildHybridVectors(studentSegments = [], internshipSegments = []) {
    const studentMap = buildWeightedFeatureMap(studentSegments);
    const internshipMap = buildWeightedFeatureMap(internshipSegments);
    const vocabulary = new Set([...studentMap.map.keys(), ...internshipMap.map.keys()]);
    const docs = [studentMap.map, internshipMap.map];

    const studentVector = new Map();
    const internshipVector = new Map();

    vocabulary.forEach((feature) => {
        const df = docs.reduce((count, doc) => count + (doc.has(feature) ? 1 : 0), 0);
        const idf = Math.log((docs.length + 1) / (df + 1)) + 1;
        const tfStudent = (studentMap.map.get(feature) || 0) / studentMap.totalWeight;
        const tfInternship = (internshipMap.map.get(feature) || 0) / internshipMap.totalWeight;

        studentVector.set(feature, tfStudent * idf);
        internshipVector.set(feature, tfInternship * idf);
    });

    return { studentVector, internshipVector };
}

function cosineSimilarity(vectorA, vectorB) {
    let dotProduct = 0;
    let magnitudeA = 0;
    let magnitudeB = 0;

    const terms = new Set([...vectorA.keys(), ...vectorB.keys()]);
    terms.forEach((term) => {
        const a = vectorA.get(term) || 0;
        const b = vectorB.get(term) || 0;
        dotProduct += a * b;
        magnitudeA += a * a;
        magnitudeB += b * b;
    });

    if (magnitudeA === 0 || magnitudeB === 0) return 0;
    return dotProduct / (Math.sqrt(magnitudeA) * Math.sqrt(magnitudeB));
}

function sigmoidSmooth(value = 0) {
    const clamped = Math.max(0, Math.min(1, value));
    const sigmoid = 1 / (1 + Math.exp(-6 * (clamped - 0.5)));
    return (clamped * 0.8) + (sigmoid * 0.2);
}

function similarityFromLevenshtein(left = '', right = '') {
    const source = normalizeText(left).replace(/\s+/g, '');
    const target = normalizeText(right).replace(/\s+/g, '');
    if (!source || !target) return 0;
    if (source === target) return 1;

    const previous = Array.from({ length: target.length + 1 }, (_, index) => index);
    let current = new Array(target.length + 1).fill(0);

    for (let sourceIndex = 1; sourceIndex <= source.length; sourceIndex += 1) {
        current[0] = sourceIndex;
        for (let targetIndex = 1; targetIndex <= target.length; targetIndex += 1) {
            const cost = source[sourceIndex - 1] === target[targetIndex - 1] ? 0 : 1;
            current[targetIndex] = Math.min(
                current[targetIndex - 1] + 1,
                previous[targetIndex] + 1,
                previous[targetIndex - 1] + cost
            );
        }
        for (let i = 0; i < previous.length; i += 1) {
            previous[i] = current[i];
        }
    }

    const distance = previous[target.length];
    return 1 - (distance / Math.max(source.length, target.length));
}

function buildReasoning({ topMatchingKeywords = [], studentDepartment = '', internshipDepartment = '', departmentMatched = true }) {
    if (!departmentMatched) {
        return `Department mismatch detected for ${studentDepartment || 'your department'}. This internship is filtered out before scoring.`;
    }

    if (!topMatchingKeywords.length) {
        return 'The internship and student profile share limited keyword overlap after preprocessing.';
    }

    const preview = topMatchingKeywords.slice(0, 3).join(', ');
    return `Matched through ${preview} keywords after lemmatization, typo-tolerant n-grams, and hybrid cosine scoring.`;
}

function buildTopMatchingKeywords(studentSegments = [], internshipSegments = []) {
    const studentTokens = studentSegments.flatMap((segment) => tokenizeText(segment.text).map((token) => ({
        raw: token,
        canonical: lemmaToken(token),
        source: segment.source,
        weight: getTokenImportance(lemmaToken(token)) * Number(segment.weight || 1)
    }))).filter((item) => item.canonical);

    const internshipTokens = internshipSegments.flatMap((segment) => tokenizeText(segment.text).map((token) => ({
        raw: token,
        canonical: lemmaToken(token),
        source: segment.source,
        weight: getTokenImportance(lemmaToken(token)) * Number(segment.weight || 1)
    }))).filter((item) => item.canonical);

    const matches = [];
    const studentByCanonical = new Map();
    studentTokens.forEach((item) => {
        const list = studentByCanonical.get(item.canonical) || [];
        list.push(item);
        studentByCanonical.set(item.canonical, list);
    });

    internshipTokens.forEach((internshipItem) => {
        const sameConcept = studentByCanonical.get(internshipItem.canonical) || [];
        if (sameConcept.length > 0) {
            const best = sameConcept.reduce((currentBest, item) => (item.weight > currentBest.weight ? item : currentBest), sameConcept[0]);
            matches.push({
                keyword: internshipItem.canonical,
                matchedWith: best.raw,
                matchType: 'lemma',
                contribution: Math.min(internshipItem.weight, best.weight),
                confidence: 1
            });
            return;
        }

        let bestMatch = null;
        let bestConfidence = 0;
        studentTokens.forEach((studentItem) => {
            const confidence = similarityFromLevenshtein(studentItem.canonical, internshipItem.canonical);
            const ngramBoost = similarityFromLevenshtein(
                extractCharacterNgrams(studentItem.canonical, 2, 4).join(''),
                extractCharacterNgrams(internshipItem.canonical, 2, 4).join('')
            );
            const combinedConfidence = (confidence * 0.65) + (ngramBoost * 0.35);
            if (combinedConfidence > bestConfidence) {
                bestConfidence = combinedConfidence;
                bestMatch = studentItem;
            }
        });

        if (bestMatch && bestConfidence >= 0.72) {
            matches.push({
                keyword: internshipItem.canonical,
                matchedWith: bestMatch.raw,
                matchType: 'fuzzy',
                contribution: Math.min(internshipItem.weight, bestMatch.weight) * bestConfidence,
                confidence: bestConfidence
            });
        }
    });

    const deduped = new Map();
    matches.forEach((match) => {
        const existing = deduped.get(match.keyword);
        if (!existing || existing.contribution < match.contribution) {
            deduped.set(match.keyword, match);
        }
    });

    return Array.from(deduped.values())
        .sort((a, b) => b.contribution - a.contribution || b.confidence - a.confidence || a.keyword.localeCompare(b.keyword));
}

function evaluateInternshipMatch(internship = {}, profile = {}, options = {}) {
    const student = options.student || {};
    const studentDepartment = String(
        options.studentDepartment
        || profile?.personalInfo?.department
        || profile?.department
        || student?.department
        || ''
    ).trim();
    const internshipDepartment = String(internship?.department || '').trim();
    const targetDepartments = Array.isArray(internship?.targetDepartments) ? internship.targetDepartments : [];

    const departmentMatched = isDepartmentCompatible(studentDepartment, internshipDepartment, targetDepartments);
    if (!departmentMatched) {
        return {
            score: 0,
            rawScore: 0,
            cosineScore: 0,
            smoothedScore: 0,
            departmentMatched: false,
            topMatchingKeywords: [],
            matchedTerms: [],
            matchedSkills: [],
            reasoning: buildReasoning({ studentDepartment, internshipDepartment, departmentMatched: false }),
            studentTokens: [],
            internshipTokens: []
        };
    }

    const studentSegments = collectStudentSegments(profile, student);
    const internshipSegments = collectInternshipSegments(internship);
    const { studentVector, internshipVector } = buildHybridVectors(studentSegments, internshipSegments);
    const cosineScore = cosineSimilarity(studentVector, internshipVector);
    const topMatchingKeywords = buildTopMatchingKeywords(studentSegments, internshipSegments);
    const weightedConfidence = topMatchingKeywords.reduce((sum, item) => sum + (Number(item.confidence || 0) * Number(item.contribution || 0)), 0);
    const weightedContribution = topMatchingKeywords.reduce((sum, item) => sum + Number(item.contribution || 0), 0) || 1;

    const keywordScore = Math.max(0, Math.min(1, weightedConfidence / weightedContribution));
    const rawScore = Math.max(0, Math.min(1, (cosineScore * 0.35) + (keywordScore * 0.65)));
    const smoothedScore = sigmoidSmooth(rawScore);
    const score = Math.max(0, Math.min(100, Math.round(smoothedScore * 100)));

    return {
        score,
        rawScore: Number(rawScore.toFixed(4)),
        cosineScore: Number((cosineScore * 100).toFixed(2)),
        smoothedScore: Number((smoothedScore * 100).toFixed(2)),
        departmentMatched: true,
        topMatchingKeywords: topMatchingKeywords.slice(0, 10),
        matchedTerms: topMatchingKeywords.slice(0, 10),
        matchedSkills: topMatchingKeywords.slice(0, 10),
        studentTokens: studentSegments.flatMap((segment) => tokenizeText(segment.text)),
        internshipTokens: internshipSegments.flatMap((segment) => tokenizeText(segment.text)),
        vectors: {
            student: studentVector,
            internship: internshipVector
        },
        reasoning: buildReasoning({
            topMatchingKeywords: topMatchingKeywords.map((item) => item.keyword),
            studentDepartment,
            internshipDepartment,
            departmentMatched: true
        })
    };
}

async function getCalculatedMatch(studentId, internshipId) {
    if (!studentId || !internshipId) {
        return null;
    }

    const User = require('../models/User');
    const Profile = require('../models/Profile');
    const Internship = require('../models/Internship');

    const [student, profile, internship] = await Promise.all([
        User.findById(studentId).select('department college role isVerified verificationStatus').lean(),
        Profile.findOne({ userId: studentId }).lean(),
        Internship.findById(internshipId).lean()
    ]);

    if (!student || !internship) {
        return null;
    }

    const studentDepartment = String(profile?.personalInfo?.department || student?.department || '').trim().toLowerCase();
    return evaluateInternshipMatch(internship, profile, { student, studentDepartment });
}

function calculateMatchScore(studentProfile = {}, internshipRequirement = {}, options = {}) {
    return evaluateInternshipMatch(internshipRequirement, studentProfile, options);
}

module.exports = {
    STOP_WORDS,
    GENERAL_TERMS,
    HIGH_VALUE_TERMS,
    normalizeText,
    tokenizeText,
    toDocumentText,
    buildStudentVectorString,
    buildInternshipVectorString,
    extractCharacterNgrams,
    lemmaToken,
    resolveDepartmentKey,
    isDepartmentCompatible,
    collectStudentSegments,
    collectInternshipSegments,
    buildHybridVectors,
    cosineSimilarity,
    similarityFromLevenshtein,
    buildTopMatchingKeywords,
    evaluateInternshipMatch,
    calculateMatchScore,
    getCalculatedMatch,
    buildReasoning,
    sigmoidSmooth
};