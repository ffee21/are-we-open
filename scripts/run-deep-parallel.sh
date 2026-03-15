#!/bin/bash
# 심층 분석 병렬 실행 스크립트
# 사용법: bash scripts/run-deep-parallel.sh [배치수] [필터]
# 예: bash scripts/run-deep-parallel.sh 25
#     bash scripts/run-deep-parallel.sh 10 ministry

BATCHES=${1:-25}
FILTER=${2:-""}

echo "=== 심층 분석 병렬 실행 ==="

# 대상 ID 추출
if [ -n "$FILTER" ]; then
  IDS=$(node -e "
    var d=JSON.parse(require('fs').readFileSync('data/results.json','utf-8'));
    var orgs=d.organizations.filter(function(o){
      return o.url && o.url.startsWith('http') && o.robots_txt && o.robots_txt.exists && !o.robots_txt.full_block && o.org_type==='$FILTER';
    });
    console.log(orgs.map(function(o){return o.org_id;}).join(','));
  ")
else
  IDS=$(node -e "
    var d=JSON.parse(require('fs').readFileSync('data/results.json','utf-8'));
    var orgs=d.organizations.filter(function(o){
      return o.url && o.url.startsWith('http') && o.robots_txt && o.robots_txt.exists && !o.robots_txt.full_block;
    });
    console.log(orgs.map(function(o){return o.org_id;}).join(','));
  ")
fi

# ID 배열로 변환
IFS=',' read -r -a ID_ARRAY <<< "$IDS"
TOTAL=${#ID_ARRAY[@]}
CHUNK_SIZE=$(( (TOTAL + BATCHES - 1) / BATCHES ))

echo "대상: ${TOTAL}개 기관"
echo "배치: ${BATCHES}개 (각 ~${CHUNK_SIZE}개)"
echo ""

# 배치별 실행
PIDS=()
for ((i=0; i<BATCHES; i++)); do
  START=$((i * CHUNK_SIZE))
  END=$((START + CHUNK_SIZE))
  if [ $END -gt $TOTAL ]; then END=$TOTAL; fi
  if [ $START -ge $TOTAL ]; then break; fi

  BATCH_IDS=$(echo "${ID_ARRAY[@]:$START:$CHUNK_SIZE}" | tr ' ' ',')
  BATCH_COUNT=$((END - START))

  node scripts/deep-analyze-browser.js --ids "$BATCH_IDS" --batch-id "batch-$i" > /tmp/deep-parallel-$i.log 2>&1 &
  PIDS+=($!)
  echo "Batch $i 시작 (${BATCH_COUNT}개, PID: ${PIDS[-1]})"
done

echo ""
echo "${#PIDS[@]}개 배치 실행 중... 완료 대기"

# 완료 대기
for PID in "${PIDS[@]}"; do
  wait $PID
done

echo ""
echo "=== 모든 배치 완료 ==="

# 배치별 결과 요약
for ((i=0; i<${#PIDS[@]}; i++)); do
  BLOCKED=$(grep -c 'X차단' /tmp/deep-parallel-$i.log 2>/dev/null || echo 0)
  TOTAL_DONE=$(grep -c '\.\.\.' /tmp/deep-parallel-$i.log 2>/dev/null || echo '?')
  echo "Batch $i: 차단 ${BLOCKED}건"
done

echo ""
echo "결과 병합 중..."
node scripts/merge-deep-results.js

echo ""
echo "=== 완료 ==="
