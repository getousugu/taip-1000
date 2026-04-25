import { generateExamText, fetchAvailableModels } from './groq_service.js';
import { calculateDiff } from './diff_engine.js';

// HTML特殊文字をエスケープ（diff表示用）
function escapeHtml(str) {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\n/g, '<br>');
}

class ExamApp {
    constructor() {
        this.elements = {
            apiKey: document.getElementById('api-key'),
            charCount: document.getElementById('char-count'),
            difficulty: document.getElementById('difficulty'),
            genre: document.getElementById('genre'),
            timeLimit: document.getElementById('time-limit'),
            targetModel: document.getElementById('target-model'),
            startBtn: document.getElementById('start-btn'),
            finishBtn: document.getElementById('finish-btn'),
            retryBtn: document.getElementById('retry-btn'),

            screens: {
                menu: document.getElementById('menu'),
                loading: document.getElementById('loading'),
                game: document.getElementById('game'),
                result: document.getElementById('result')
            },

            targetText: document.getElementById('target-text'),
            examInput: document.getElementById('exam-input'),
            timer: document.getElementById('timer'),
            currentCount: document.getElementById('current-count'),
            targetCount: document.getElementById('target-count'),

            resCorrect: document.getElementById('res-correct'),
            resMistakes: document.getElementById('res-mistakes'),
            resOmissions: document.getElementById('res-omissions'),
            resAdditions: document.getElementById('res-additions'),
            finalRank: document.getElementById('final-rank'),
            finalWpm: document.getElementById('final-wpm'),
            diffDisplay: document.getElementById('diff-display'),
        };

        this.state = {
            target: "",
            timer: null,
            initialTime: 0,
            startTime: null,
        };

        this.init();
    }

    async init() {
        const savedKey = localStorage.getItem('groq_api_key');
        if (savedKey) {
            this.elements.apiKey.value = savedKey;
            this.refreshModels(savedKey);
        }

        this.elements.apiKey.addEventListener('blur', () => {
            const key = this.elements.apiKey.value.trim();
            if (key) {
                localStorage.setItem('groq_api_key', key);
                this.refreshModels(key);
            }
        });

        this.elements.startBtn.addEventListener('click', () => this.startExam());
        this.elements.finishBtn.addEventListener('click', () => this.finishExam());
        this.elements.retryBtn.addEventListener('click', () => {
            clearInterval(this.state.timer);
            this.state.timer = null;
            this.showScreen('menu');
        });

        this.elements.examInput.addEventListener('input', () => {
            const count = this.elements.examInput.value.length;
            this.elements.currentCount.textContent = count;
            this.autoScrollTarget(count);
        });
    }

    async refreshModels(apiKey) {
        const models = await fetchAvailableModels(apiKey);
        if (models.length > 0) {
            this.elements.targetModel.innerHTML = models.map(m =>
                `<option value="${m.id}">${m.id}</option>`
            ).join('');
        }
        // models.length === 0 の場合はデフォルトオプションをそのまま保持
    }

    async startExam() {
        const apiKey = this.elements.apiKey.value.trim();
        if (!apiKey) return alert('Groq APIキーを入力してください');
        localStorage.setItem('groq_api_key', apiKey);

        this.showScreen('loading');

        try {
            const config = {
                apiKey,
                charCount: this.elements.charCount.value,
                difficulty: this.elements.difficulty.value,
                genre: this.elements.genre.value,
                model: this.elements.targetModel.value
            };

            const text = await generateExamText(config);
            this.state.target = text;
            this.elements.targetText.textContent = text;
            this.elements.targetText.scrollTop = 0;
            this.elements.targetCount.textContent = text.length;
            this.elements.examInput.value = "";
            this.elements.currentCount.textContent = "0";

            this.showScreen('game');
            this.startTimer(parseInt(this.elements.timeLimit.value));
            this.elements.examInput.focus();
        } catch (err) {
            console.error('Groq Generation Error:', err);
            alert('課題生成中にエラーが発生しました。詳細はコンソールを確認してください。');
            this.showScreen('menu');
        }
    }

    showScreen(name) {
        Object.entries(this.elements.screens).forEach(([key, el]) => {
            el.classList.toggle('active', key === name);
        });
    }

    startTimer(seconds) {
        this.state.initialTime = seconds;
        this.state.startTime = Date.now();
        this.state.timeLeft = seconds; // 表示用キャッシュ

        this.updateTimerDisplay(seconds);

        if (this.state.timer) clearInterval(this.state.timer);
        this.state.timer = setInterval(() => {
            // Date.now()ベースで計算 — タブ非アクティブ/負荷によるズレを防ぐ
            const elapsed = Math.floor((Date.now() - this.state.startTime) / 1000);
            const remaining = Math.max(0, this.state.initialTime - elapsed);
            this.state.timeLeft = remaining;
            this.updateTimerDisplay(remaining);

            if (remaining <= 0) {
                this.finishExam();
            }
        }, 500); // 500ms毎にチェックして精度向上
    }

    updateTimerDisplay(timeLeft) {
        const m = Math.floor(timeLeft / 60);
        const s = timeLeft % 60;
        this.elements.timer.textContent = `${m}:${s.toString().padStart(2, '0')}`;

        if (timeLeft < 60) {
            this.elements.timer.classList.add('timer-warning');
        } else {
            this.elements.timer.classList.remove('timer-warning');
            this.elements.timer.style.color = '';
        }
    }

    autoScrollTarget(typedLength) {
        const targetEl = this.elements.targetText;
        const total = this.state.target.length;
        if (total === 0) return;
        const ratio = Math.min(1, typedLength / total);
        const scrollMax = targetEl.scrollHeight - targetEl.clientHeight;
        if (scrollMax > 0) {
            targetEl.scrollTop = scrollMax * ratio;
        }
    }

    finishExam() {
        clearInterval(this.state.timer);
        this.state.timer = null;

        const input = this.elements.examInput.value;
        const result = calculateDiff(this.state.target, input);

        // 純速度: 正解文字数 ÷ 経過分
        const elapsedMinutes = Math.max(0.01, (Date.now() - this.state.startTime) / 60000);
        const kpm = Math.round(result.correct / elapsedMinutes);

        this.elements.resCorrect.textContent = result.correct;
        this.elements.resMistakes.textContent = result.mistakes;
        this.elements.resOmissions.textContent = result.omissions;
        this.elements.resAdditions.textContent = result.additions;
        this.elements.finalWpm.textContent = kpm;

        // ランク判定 — 正確度は課題文文字数に対する正解率
        const accuracy = result.correct / Math.max(1, this.state.target.length);
        let rank = 'D';
        if      (kpm > 150 && accuracy > 0.95) rank = 'S';
        else if (kpm > 100 && accuracy > 0.90) rank = 'A';
        else if (kpm > 60  && accuracy > 0.80) rank = 'B';
        else if (kpm > 30)                     rank = 'C';

        this.elements.finalRank.textContent = rank;
        this.elements.finalRank.className = `value rank-${rank.toLowerCase()}`;

        // 差分ハイライト表示
        this.renderDiff(result.alignment);

        this.showScreen('result');
    }

    renderDiff(alignment) {
        const container = this.elements.diffDisplay;
        if (!alignment) {
            container.innerHTML = '<p class="diff-unavailable">テキストが長すぎるため、差分の詳細表示は省略されました。</p>';
            return;
        }

        const html = alignment.map(a => {
            const escaped = escapeHtml(a.char);
            switch (a.type) {
                case 'match':    return `<span class="diff-match">${escaped}</span>`;
                case 'omission': return `<span class="diff-omission" title="脱字">${escaped}</span>`;
                case 'addition': return `<span class="diff-addition" title="余過">${escaped}</span>`;
                default:         return escaped;
            }
        }).join('');

        container.innerHTML = html;
    }
}

new ExamApp();
