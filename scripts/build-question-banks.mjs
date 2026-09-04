import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = path.resolve(process.cwd());
const BANK_DIR = path.join(ROOT, 'question-banks');
const PACK_DIR = path.join(ROOT, 'packs');
const PUBLIC_BASE = 'https://ddrnfinch.github.io/Naxos-Mapping_Engine/question-banks/';

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function bankFile(bankId, category, courseId, questions, extra = {}, version = 1) {
  if (!Array.isArray(questions) || !questions.length) throw new Error(`No questions generated for ${bankId}`);
  const correctAnswers = new Map();
  for (const question of questions) {
    if (!question?.id || !question?.question || !Array.isArray(question.answers) || question.answers.length !== 4) {
      throw new Error(`Invalid question in ${bankId}`);
    }
    if (!Number.isInteger(question.correct) || question.correct < 0 || question.correct > 3) {
      throw new Error(`Invalid correct answer in ${bankId}: ${question.id}`);
    }
    if (category === 'trade' || category === 'epa') {
      const correctText = String(question.answers[question.correct] || '').trim().toLowerCase();
      const previous = correctAnswers.get(correctText);
      if (previous) throw new Error(`Repeated correct-answer text in ${bankId}: ${previous} and ${question.id}`);
      correctAnswers.set(correctText, question.id);
    }
  }
  return {
    naxosQuestionBank: 1,
    schemaVersion: 1,
    bankId,
    version,
    category,
    courseId,
    questionCount: questions.length,
    ...extra,
    questions
  };
}

function updatePackQuestionRefs(packPath, refs) {
  const pack = readJson(packPath);
  pack.questionBank = {
    schemaVersion: 1,
    source: 'Naxos',
    ...refs
  };
  writeJson(packPath, pack);
}

function categoryToCourseNode(category) {
  return {
    label: String(category?.title || category?.id || 'Category'),
    children: (category?.subcategories || []).map((subcategory) => ({
      label: String(subcategory?.title || subcategory?.id || 'Section'),
      children: (subcategory?.tasks || []).map((task) => ({
        label: String(task?.title || task?.id || 'Task'),
        mappedAtomicTargets: Array.isArray(task?.mappedAtomicTargets) ? task.mappedAtomicTargets.map(String) : [],
        acTargets: Array.isArray(task?.acTargets) ? task.acTargets.map(String) : []
      }))
    }))
  };
}

function loadPackCategories(packPath, pack) {
  const base = path.dirname(packPath);
  const categories = (pack.categoryFiles || []).map((relativePath) => readJson(path.resolve(base, relativePath)));
  if (pack?.qualification?.id === '6570-04' && categories[4] && pack?.route?.title) {
    categories[4] = JSON.parse(JSON.stringify(categories[4]));
    categories[4].title = pack.route.title;
  }
  return categories;
}

function sharedRef(name) {
  return `${PUBLIC_BASE}${name}`;
}

function validateUniqueIds(files) {
  const seen = new Map();
  for (const file of files) {
    const bank = readJson(path.join(BANK_DIR, file));
    for (const q of bank.questions || []) {
      const existing = seen.get(q.id);
      if (existing && existing !== JSON.stringify(q)) throw new Error(`Question id collision with different content: ${q.id}`);
      seen.set(q.id, JSON.stringify(q));
    }
  }
  return seen.size;
}

globalThis.window = globalThis;
await import(`${pathToFileURL(path.join(BANK_DIR, 'question-bank-engine-v1.js')).href}?build=${Date.now()}`);
await import(`${pathToFileURL(path.join(BANK_DIR, 'question-bank-engine-v2.js')).href}?build=${Date.now()}`);
await import(`${pathToFileURL(path.join(BANK_DIR, 'question-bank-engine-v3.js')).href}?build=${Date.now()}`);
await import(`${pathToFileURL(path.join(BANK_DIR, 'question-bank-engine-v5.js')).href}?build=${Date.now()}`);
const engine = globalThis.NaxosQuestionBankV5;
if (!engine?.build) throw new Error('Naxos question-bank engine v5 did not initialise.');

const generatedFiles = [];

// Keep the already-approved static Maths bank if present; only generate it if missing.
const mathsPath = path.join(BANK_DIR, 'maths-v1.json');
if (!fs.existsSync(mathsPath)) {
  const maths = engine.build('maths', {});
  writeJson(mathsPath, bankFile('maths-v1', 'maths', 'ALL', maths));
}
const mathsBank = readJson(mathsPath);
if (mathsBank.questionCount !== 50 || !Array.isArray(mathsBank.questions) || mathsBank.questions.length !== 50) {
  throw new Error('maths-v1.json must contain exactly 50 questions.');
}
generatedFiles.push('maths-v1.json');

const english = engine.build('english', {});
writeJson(path.join(BANK_DIR, 'english-v1.json'), bankFile('english-v1', 'english', 'ALL', english));
generatedFiles.push('english-v1.json');

const ksbCourses = [
  ['ST0095', 'ST0095-v1.json'],
  ['ST0264-SITE', 'ST0264-SITE-v1.json'],
  ['ST0264-AJ', 'ST0264-AJ-v1.json'],
  ['ST0171', 'ST0171-v1.json']
];

const manifestCourses = {};

for (const [courseId, packName] of ksbCourses) {
  const packPath = path.join(PACK_DIR, packName);
  const pack = readJson(packPath);
  const registry = readJson(path.resolve(path.dirname(packPath), pack.ksbRegistry));
  const context = {
    courseId,
    meta: {
      qualificationId: courseId,
      qualification: { id: courseId },
      officialItems: registry.items || {}
    },
    courseItems: []
  };
  const trade = engine.build('trade', context);
  const epa = engine.build('epa', context);
  if (trade.length !== 50 || epa.length !== 50) throw new Error(`${courseId} must generate 50 Trade and 50 EPA questions.`);

  const tradeFile = `${courseId}-trade-v1.json`;
  const epaFile = `${courseId}-epa-v1.json`;
  writeJson(path.join(BANK_DIR, tradeFile), bankFile(`${courseId}-trade-v1`, 'trade', courseId, trade, {}, 4));
  writeJson(path.join(BANK_DIR, epaFile), bankFile(`${courseId}-epa-v1`, 'epa', courseId, epa, {}, 4));
  generatedFiles.push(tradeFile, epaFile);

  updatePackQuestionRefs(packPath, {
    maths: sharedRef('maths-v1.json'),
    english: sharedRef('english-v1.json'),
    trade: sharedRef(tradeFile),
    epa: sharedRef(epaFile)
  });

  manifestCourses[courseId] = {
    maths: 'question-banks/maths-v1.json',
    english: 'question-banks/english-v1.json',
    trade: `question-banks/${tradeFile}`,
    epa: `question-banks/${epaFile}`,
    learnerQuestionCount: 200
  };
}

const nvqRoutes = {
  '6570-04': ['cladding', 'thin', 'repair', 'concrete', 'specialist', 'drainage'],
  '6570-05': ['thin', 'repair', 'specialist', 'drainage']
};

for (const [courseId, routes] of Object.entries(nvqRoutes)) {
  manifestCourses[courseId] = { routes: {} };
  for (const route of routes) {
    const packName = `${courseId}-${route}-v1.json`;
    const packPath = path.join(PACK_DIR, packName);
    const pack = readJson(packPath);
    const categories = loadPackCategories(packPath, pack);
    const courseItems = categories.map(categoryToCourseNode);
    const context = {
      courseId,
      meta: {
        qualificationId: courseId,
        qualification: { id: courseId },
        units: (pack?.route?.activeUnits || []).map(String)
      },
      courseItems
    };
    const trade = engine.build('trade', context);
    if (trade.length !== 50) throw new Error(`${courseId} ${route} must generate exactly 50 Trade questions.`);

    const tradeFile = `${courseId}-${route}-trade-v1.json`;
    writeJson(path.join(BANK_DIR, tradeFile), bankFile(`${courseId}-${route}-trade-v1`, 'trade', courseId, trade, { route }, 4));
    generatedFiles.push(tradeFile);

    updatePackQuestionRefs(packPath, {
      maths: sharedRef('maths-v1.json'),
      english: sharedRef('english-v1.json'),
      trade: sharedRef(tradeFile)
    });

    manifestCourses[courseId].routes[route] = {
      maths: 'question-banks/maths-v1.json',
      english: 'question-banks/english-v1.json',
      trade: `question-banks/${tradeFile}`,
      learnerQuestionCount: 150
    };
  }
}

const uniqueQuestionCount = validateUniqueIds(generatedFiles);
if (uniqueQuestionCount !== 720) {
  throw new Error(`Expected 720 unique master question ids, found ${uniqueQuestionCount}.`);
}

writeJson(path.join(BANK_DIR, 'manifest.json'), {
  naxosQuestionBankManifest: 1,
  schemaVersion: 2,
  version: 5,
  sourceOfTruth: 'Naxos',
  delivery: 'static-course-referenced-json',
  generatedQuestionCount: uniqueQuestionCount,
  shared: {
    maths: { file: 'question-banks/maths-v1.json', count: 50 },
    english: { file: 'question-banks/english-v1.json', count: 50 }
  },
  courses: manifestCourses,
  answerCount: 4,
  answerPosition: 'varied',
  correctAnswerReuse: 'prohibited-within-trade-or-epa-bank',
  metadata: ['id', 'category', 'courseId', 'difficulty', 'mappings', 'explanation', 'active']
});

console.log(`Built ${generatedFiles.length} static bank files with ${uniqueQuestionCount} unique question ids.`);
