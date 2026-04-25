import Groq from 'groq-sdk';

export async function generateExamText(config) {
    const { apiKey, charCount, difficulty, genre, model } = config;
    const groq = new Groq({ apiKey, dangerouslyAllowBrowser: true });

    // 難易度定義
    let diffContext = "";
    if (difficulty === 'beginner') {
        diffContext = "小学校で習う漢字を中心とし、熟語は少なめで平易な文章にしてください。";
    } else if (difficulty === 'intermediate') {
        diffContext = "常用漢字を適切に使用し、経済や社会などの一般的な熟語を多く含めた標準的な検定レベルの文章にしてください。";
    } else if (difficulty === 'advanced') {
        diffContext = "新聞の社説や専門書のような、複雑な熟語、専門用語、記号を多用した高度な文章にしてください。";
    }

    const prompt = `
あなたはプロのタイピング検定課題の作成者です。
現在、${charCount}文字以上の課題文が求められています。

以下の条件を【厳守】してください：
1. **絶対文字数**: 必ず【${charCount}文字以上】にしてください。もし内容が足りない場合は、詳細な描写や背景説明を加えて文章を膨らませてください。短すぎる出力は失格です。
2. **構成**: 文章を3つ以上の段落（序論・本論・結論）に分け、ボリューミーな内容にしてください。
3. **ジャンル**: ${genre}。
4. **難易度**: ${diffContext}
5. **形式**: 検定用のため、文章は1つのまとまった長文として出力してください。
6. **文字の見栄え**: 漢字、ひらがな、カタカナ、句読点が適切に混ざった、美しくも練習になる日本語にしてください。

余計な挨拶や説明は一切不要です。【課題文のみ】を出力してください。
文字数が足りない場合は、さらに詳細を書き足して${charCount}文字を確実に超えるようにしてください。
`;

    // 日本語1文字 ≈ 1.5〜2トークン。余裕を持って3倍を確保
    const dynamicMaxTokens = Math.min(8000, Math.max(2000, Math.ceil(charCount * 3)));

    const chatCompletion = await groq.chat.completions.create({
        messages: [{ role: 'user', content: prompt }],
        model: model || 'llama-3.3-70b-versatile',
        temperature: 0.8,
        max_tokens: dynamicMaxTokens,
    });

    let content = chatCompletion.choices[0]?.message?.content || "";

    // コードブロックが混入した場合を除去
    content = content.replace(/```[a-z]*\n?/gi, '').replace(/```/g, '');

    return content.trim();
}

/**
 * 利用可能なモデルを取得し、「賢い」ものを最大8つ選定して返却する
 */
export async function fetchAvailableModels(apiKey) {
    const groq = new Groq({ apiKey, dangerouslyAllowBrowser: true });
    try {
        const response = await groq.models.list();
        const models = response.data;

        // 除外: whisper (音声), distil (蒸留), guard (安全チェック用)
        const sorted = models
            .filter(m => !['whisper', 'distil', 'guard'].some(word => m.id.includes(word)))
            .sort((a, b) => {
                const getScore = (id) => {
                    if (id.includes('llama-3.3-70b')) return 100;
                    if (id.includes('llama-3.1-405b')) return 95;
                    if (id.includes('llama-3.1-70b')) return 90;
                    if (id.includes('mixtral-8x7b')) return 85;
                    if (id.includes('llama-3.2-90b')) return 80;
                    if (id.includes('gemma2-9b')) return 50;
                    if (id.includes('llama3-70b')) return 40;
                    return 10;
                };
                return getScore(b.id) - getScore(a.id);
            });

        // 同系統の重複を除去（より具体的なIDを優先するため id フルパスをキーに）
        const seen = new Set();
        const unique = [];
        for (const m of sorted) {
            // versatiole/specdec 等の末尾バリアントは別物として保持、
            // 完全に同一IDのみ除外
            if (!seen.has(m.id)) {
                unique.push(m);
                seen.add(m.id);
            }
        }

        return unique.slice(0, 8);
    } catch (err) {
        console.error('Failed to fetch models:', err);
        return [];
    }
}
