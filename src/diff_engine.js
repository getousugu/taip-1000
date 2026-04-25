/**
 * 精密採点エンジン
 * LCSアルゴリズムで誤字・脱字・余過を算出し、差分アライメントを返します。
 * メモリ安全のため n*m > MAX_SAFE_CELLS の場合は簡易モードにフォールバックします。
 */

const MAX_SAFE_CELLS = 4_000_000; // ~16MB (Int32Array) — 2000×2000 まで

export function calculateDiff(target, input) {
    const n = target.length;
    const m = input.length;

    if (n * m > MAX_SAFE_CELLS) {
        return simpleDiff(target, input);
    }

    // DP Table for LCS (Longest Common Subsequence)
    const dp = new Int32Array((n + 1) * (m + 1));
    const getIdx = (i, j) => i * (m + 1) + j;

    for (let i = 1; i <= n; i++) {
        for (let j = 1; j <= m; j++) {
            if (target[i - 1] === input[j - 1]) {
                dp[getIdx(i, j)] = dp[getIdx(i - 1, j - 1)] + 1;
            } else {
                dp[getIdx(i, j)] = Math.max(dp[getIdx(i - 1, j)], dp[getIdx(i, j - 1)]);
            }
        }
    }

    // バックトラック: 差分アライメントを構築
    const alignment = [];
    let i = n, j = m;
    let additions = 0, omissions = 0;

    while (i > 0 || j > 0) {
        if (i > 0 && j > 0 && target[i - 1] === input[j - 1]) {
            alignment.unshift({ type: 'match', char: target[i - 1] });
            i--; j--;
        } else if (j > 0 && (i === 0 || dp[getIdx(i, j - 1)] >= dp[getIdx(i - 1, j)])) {
            alignment.unshift({ type: 'addition', char: input[j - 1] });
            additions++;
            j--;
        } else {
            alignment.unshift({ type: 'omission', char: target[i - 1] });
            omissions++;
            i--;
        }
    }

    const actualMistakes = Math.min(additions, omissions);
    const actualAdditions = additions - actualMistakes;
    const actualOmissions = omissions - actualMistakes;

    return {
        mistakes: actualMistakes,
        omissions: actualOmissions,
        additions: actualAdditions,
        correct: dp[getIdx(n, m)],
        alignment,
    };
}

/**
 * テキストが長すぎる場合のフォールバック（近似計算、差分表示なし）
 */
function simpleDiff(target, input) {
    const minLen = Math.min(target.length, input.length);
    let correct = 0, substitutions = 0;

    for (let i = 0; i < minLen; i++) {
        if (target[i] === input[i]) correct++;
        else substitutions++;
    }

    const extraInput = Math.max(0, input.length - target.length);
    const extraTarget = Math.max(0, target.length - input.length);

    return {
        mistakes: substitutions,
        omissions: extraTarget,
        additions: extraInput,
        correct,
        alignment: null, // テキストが長すぎるため差分表示は省略
    };
}
