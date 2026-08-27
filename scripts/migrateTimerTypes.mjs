import { readFileSync } from "node:fs";
import {
  applicationDefault,
  cert,
  initializeApp,
} from "firebase-admin/app";
import { getDatabase } from "firebase-admin/database";

const args = new Set(process.argv.slice(2));

const isLocal = args.has("--local");
const isRemote = args.has("--remote");
const confirmed = args.has("--confirm");

if (isLocal === isRemote) {
  console.error(
    "[migration] --local 또는 --remote 중 하나만 지정하세요."
  );
  console.error("");
  console.error("Local:");
  console.error(
    "  node scripts/migrateTimerSessions.mjs --local"
  );
  console.error("");
  console.error("Remote:");
  console.error(
    "  node scripts/migrateTimerSessions.mjs --remote --confirm"
  );
  process.exit(1);
}

const projectId =
  process.env.FIREBASE_PROJECT_ID ||
  process.env.GCLOUD_PROJECT ||
  process.env.GOOGLE_CLOUD_PROJECT || 'timer-2d681';

if (!projectId) {
  console.error("[migration] FIREBASE_PROJECT_ID가 없습니다.");
  process.exit(1);
}

let databaseURL;

if (isLocal) {
  const emulatorHost =
    process.env.FIREBASE_DATABASE_EMULATOR_HOST ||
    "127.0.0.1:9400";

  process.env.FIREBASE_DATABASE_EMULATOR_HOST =
    emulatorHost;

  databaseURL =
    process.env.FIREBASE_DATABASE_URL ||
    `https://${projectId}-default-rtdb.firebaseio.com`;

  console.log("[migration] MODE: LOCAL");
  console.log("[migration] emulator :", emulatorHost);
  console.log("[migration] projectId:", projectId);

  initializeApp({
    projectId,
    databaseURL,
  });
} else {
  if (!confirmed) {
    console.error("");
    console.error(
      "[migration] REMOTE DB를 변경하려고 합니다."
    );
    console.error(
      "[migration] 실행하려면 --confirm을 추가하세요."
    );
    console.error("");
    console.error(
      "node scripts/migrateTimerSessions.mjs --remote --confirm"
    );
    process.exit(1);
  }

  /*
   * 혹시 현재 shell에 Emulator 환경변수가 남아 있으면
   * 실제 DB 대신 Emulator로 붙을 수 있으므로 제거.
   */
  delete process.env.FIREBASE_DATABASE_EMULATOR_HOST;

  databaseURL = process.env.FIREBASE_DATABASE_URL || 'https://timer-2d681-default-rtdb.asia-southeast1.firebasedatabase.app';

  if (!databaseURL) {
    console.error(
      "[migration] REMOTE에서는 FIREBASE_DATABASE_URL이 필요합니다."
    );
    process.exit(1);
  }

  console.log("[migration] MODE: REMOTE");
  console.log("[migration] projectId  :", projectId);
  console.log("[migration] databaseURL:", databaseURL);


  const serviceAccount = JSON.parse(
    readFileSync("./serviceAccountKey.json", "utf8")
  );

  initializeApp({
    credential: cert(serviceAccount),
    projectId,
    databaseURL,
  });
}

const db = getDatabase();

console.log("[migration] users 조회 중...");

const usersSnapshot = await db.ref("users").get();

console.log(
  "[migration] users exists:",
  usersSnapshot.exists()
);

if (!usersSnapshot.exists()) {
  console.log("[migration] users 데이터가 없습니다.");
  process.exit(0);
}

const users = usersSnapshot.val();

let scannedTimers = 0;
let accumulatedTimers = 0;
let checklistTimers = 0;
let alreadyTypedTimers = 0;

const updates = {};

for (const [uid, user] of Object.entries(users)) {
  const timers = user?.timers ?? {};

  for (const [timerId, timerValue] of Object.entries(timers)) {
    scannedTimers += 1;

    const timer = timerValue ?? {};

    if (timer.type === 'accumulated' || timer.type === 'checklist') {
      alreadyTypedTimers += 1;
      continue;
    }

    const type =
      typeof timer.accumulatedMs === 'number'
        ? 'accumulated'
        : 'checklist';

    updates[`users/${uid}/timers/${timerId}/type`] = type;

    if (type === 'accumulated') {
      accumulatedTimers += 1;
    } else {
      checklistTimers += 1;
    }

    console.log(`[migration] ${uid}/${timerId} -> ${type}`);
  }
}

const updateEntries = Object.keys(updates);

if (updateEntries.length > 0) {
  await db.ref().update(updates);
}

console.log('');
console.log('--------------------------------');
console.log('[migration] scanned timers     :', scannedTimers);
console.log('[migration] accumulated added  :', accumulatedTimers);
console.log('[migration] checklist added    :', checklistTimers);
console.log('[migration] already typed      :', alreadyTypedTimers);
console.log('[migration] updated total      :', updateEntries.length);
console.log('[migration] done');
