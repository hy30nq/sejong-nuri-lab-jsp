import { db, resetAndSeed } from './database.mjs'

if (process.env.TRAINING_MODE !== '1') throw new Error('TRAINING_MODE=1에서만 실습 DB를 초기화할 수 있습니다.')
resetAndSeed()
console.log('세종누리 통합 실습 서비스 데이터를 초기화했습니다.')
db.close()
