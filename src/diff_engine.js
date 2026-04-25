/**
 * 精密採点エンジン
 * LCSアルゴリズムで誤字・脱字・余過を算出し、差分アライメントを返します。
 * メモリ安全のため n*m > MAX_SAFE_CELLS の場合は簡易モードにフォールバックします。
 */

const MAX_SAFE_CELLS = 4_000_000; // ~16MB (Int32Array) — 2000×2000 まで

export function calculateDiff(target, input) {
    const m = input.length;
    // タイピングの性質上、入力文字数から極端に離れた後方の文章と散発的にマッチして
    // 差分表示が崩れる（LCSの弱点）のを防ぐため、検索範囲を先頭から一定文字数に制限する
    const searchLimit = Math.min(target.length, m + 100);
    const targetWindow = target.slice(0, searchLimit);
    const n = targetWindow.length;

    if (n * m > MAX_SAFE_CELLS) {
        return simpleDiff(target, input);
    }

    // DP Table for LCS (Longest Common Subsequence)
    // 後方から計算することで、前方のマッチを優先（タイピングの入力順に合わせる）
    const dp = new Int32Array((n + 1) * (m + 1));
    const getIdx = (i, j) => i * (m + 1) + j;

    for (let i = n - 1; i >= 0; i--) {
        for (let j = m - 1; j >= 0; j--) {
            if (targetWindow[i] === input[j]) {
                dp[getIdx(i, j)] = dp[getIdx(i + 1, j + 1)] + 1;
            } else {
                dp[getIdx(i, j)] = Math.max(dp[getIdx(i + 1, j)], dp[getIdx(i, j + 1)]);
            }
        }
    }

    // バックトラック: 前から順に差分アライメントを構築
    const alignment = [];
    let i = 0, j = 0;

    while (i < n || j < m) {
        if (i < n && j < m && targetWindow[i] === input[j]) {
            alignment.push({ type: 'match', char: targetWindow[i] });
            i++; j++;
        } else if (j < m && (i === n || dp[getIdx(i, j + 1)] >= dp[getIdx(i + 1, j)])) {
            alignment.push({ type: 'addition', char: input[j] });
            j++;
        } else {
            alignment.push({ type: 'omission', char: targetWindow[i] });
            i++;
        }
    }

    // 検索ウィンドウから漏れた残りの課題文はすべて「脱字」として末尾に追加
    for (let k = searchLimit; k < target.length; k++) {
        alignment.push({ type: 'omission', char: target[k] });
    }

    // バックトラックで得た生のアライメントを後処理し、
    // 隣接する脱字(omission)と余過(addition)を「誤字(substitution)」に結合する
    const condensed = [];
    let i_align = 0;
    while (i_align < alignment.length) {
        if (alignment[i_align].type === 'match') {
            condensed.push(alignment[i_align]);
            i_align++;
        } else {
            let expChars = '';
            let actChars = '';
            while (i_align < alignment.length && alignment[i_align].type !== 'match') {
                if (alignment[i_align].type === 'omission') expChars += alignment[i_align].char;
                if (alignment[i_align].type === 'addition') actChars += alignment[i_align].char;
                i_align++;
            }
            
            const minLen = Math.min(expChars.length, actChars.length);
            // 共通の長さ分は「誤字(substitution)」として扱う
            for (let k = 0; k < minLen; k++) {
                condensed.push({ type: 'substitution', expected: expChars[k], char: actChars[k] });
            }
            // 余った脱字
            for (let k = minLen; k < expChars.length; k++) {
                condensed.push({ type: 'omission', char: expChars[k] });
            }
            // 余った余過
            for (let k = minLen; k < actChars.length; k++) {
                condensed.push({ type: 'addition', char: actChars[k] });
            }
        }
    }

    // カウントの再集計（レンダリングと完全に一致させる）
    let actualMistakes = 0, actualOmissions = 0, actualAdditions = 0;
    for (const item of condensed) {
        if (item.type === 'substitution') actualMistakes++;
        else if (item.type === 'omission') actualOmissions++;
        else if (item.type === 'addition') actualAdditions++;
    }

    return {
        mistakes: actualMistakes,
        omissions: actualOmissions,
        additions: actualAdditions,
        correct: dp[getIdx(0, 0)],
        alignment: condensed,
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
