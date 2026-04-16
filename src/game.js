// 1. 設定：発行されたGASのURLをここに貼り付けてください
const gasUrl = "https://script.google.com/macros/s/AKfycbwDNmdeT7ojJIXlDn0SudBRTe-uVLdue4dKSb_-4PpqcvBXhk6ZBc0HxDk_uwYPljIzqw/exec";

// 2. 変数管理
let n = 2;
let sequence = [];
let trialLogs = []; // 反応ログを格納する配列
let studentID = "";
let totalTrials = 0;
let totalMatches = 0;
let correctClicks = 0;
let timeLeft = 60;
let timerInterval;
let startTime; // 反応時間計測用

// --- 画面遷移の制御 ---

// 同意ボタンの制御
document.getElementById('consent-check').addEventListener('change', (e) => {
    document.getElementById('consent-next').disabled = !e.target.checked;
});

// 同意画面 -> ログイン画面
document.getElementById('consent-next').addEventListener('mousedown', () => {
    document.getElementById('consent-screen').style.display = 'none';
    document.getElementById('login-screen').style.display = 'block';
});

// ログイン画面 -> レベル選択画面
document.getElementById('login-submit').addEventListener('mousedown', () => {
    const input = document.getElementById('student-id').value;
    if (input.trim() === "") {
        alert("学籍番号を入力してください");
        return;
    }
    studentID = input;
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('setup').style.display = 'block';
});

// レベル選択ボタンの設定
['btn-1', 'btn-2', 'btn-3'].forEach((id, idx) => {
    const btn = document.getElementById(id);
    const start = () => startGame(idx + 1);
    btn.addEventListener('mousedown', start);
    btn.addEventListener('touchstart', (e) => { e.preventDefault(); start(); });
});

// --- ゲームロジック ---

function startGame(selectedN) {
    n = selectedN;
    document.getElementById('setup').style.display = 'none';
    document.getElementById('game').style.display = 'block';
    
    let count = 3;
    const countdown = setInterval(() => {
        if (count > 0) {
            document.getElementById('feedback-msg').innerText = count;
            count--;
        } else {
            clearInterval(countdown);
            startLogic();
        }
    }, 1000);
}

function startLogic() {
    timerInterval = setInterval(() => {
        timeLeft--;
        document.getElementById('timer').innerText = `${timeLeft}s`;
        if (timeLeft <= 0) endGame();
    }, 1000);
    nextTrial();
}

function nextTrial() {
    let nextPos;
    
    // 3回に1回(33.3%)の確率で一致させるロジック
    if (sequence.length >= n) {
        const targetPos = sequence[sequence.length - n];
        if (Math.random() < 0.333) {
            nextPos = targetPos; // 強制一致
        } else {
            do {
                nextPos = Math.floor(Math.random() * 9);
            } while (nextPos === targetPos); // 一致しないよう再抽選
        }
    } else {
        nextPos = Math.floor(Math.random() * 9);
    }

    sequence.push(nextPos);
    totalTrials++;
    document.getElementById('count-trials').innerText = totalTrials;
    
    const msg = document.getElementById('feedback-msg');
    msg.innerText = "....";
    msg.style.color = "#94a3b8";

    const cell = document.getElementById(`cell-${nextPos}`);
    cell.classList.add('active');
    document.getElementById('matchBtn').disabled = false;
    startTime = Date.now(); // 刺激提示開始時刻

    setTimeout(() => {
        cell.classList.remove('active');
        // ボタンが押されなかった場合のログ記録
        if (!document.getElementById('matchBtn').disabled) {
            recordTrial(false);
        }
        setTimeout(() => { if (timeLeft > 0) nextTrial(); }, 600);
    }, 1000);
}

// 判定ボタンの処理
const matchBtn = document.getElementById('matchBtn');
const handleMatch = (e) => {
    if (e) e.preventDefault();
    if (matchBtn.disabled) return;
    
    const rt = Date.now() - startTime; // 反応時間
    const current = sequence[sequence.length - 1];
    const target = sequence[sequence.length - (n + 1)];
    const isMatch = (current === target);
    const cell = document.getElementById(`cell-${current}`);
    const msg = document.getElementById('feedback-msg');

    if (isMatch) {
        msg.innerText = "正解！ ○";
        msg.style.color = "#22c55e";
        cell.classList.add('correct-flash');
        correctClicks++;
        document.getElementById('count-correct').innerText = correctClicks;
        setTimeout(() => cell.classList.remove('correct-flash'), 400);
    } else {
        msg.innerText = "ハズレ！ ×";
        msg.style.color = "#ef4444";
        cell.classList.add('wrong-flash');
        setTimeout(() => cell.classList.remove('wrong-flash'), 400);
    }
    
    recordTrial(true, rt);
    matchBtn.disabled = true;
};

matchBtn.addEventListener('mousedown', handleMatch);
matchBtn.addEventListener('touchstart', handleMatch);

// ログの記録
function recordTrial(pressed, rt = 0) {
    const current = sequence[sequence.length - 1];
    const target = (sequence.length > n) ? sequence[sequence.length - (n + 1)] : null;
    const isMatch = (target !== null && current === target);
    const isCorrect = pressed ? isMatch : !isMatch;

    trialLogs.push({
        student_id: studentID,
        level: n,
        trial_no: totalTrials,
        target_pos: current,
        is_match: isMatch ? 1 : 0,
        user_pressed: pressed ? 1 : 0,
        is_correct: isCorrect ? 1 : 0,
        rt: rt,
        timestamp: new Date().toLocaleString('ja-JP')
    });
}

// --- 終了とデータ送信 ---

async function endGame() {
    clearInterval(timerInterval);
    document.getElementById('game').style.display = 'none';
    document.getElementById('result').style.display = 'block';

    // 一致チャンスの総数を計算
    let actualMatches = 0;
    for(let i = n; i < sequence.length; i++) {
        if(sequence[i] === sequence[i-n]) actualMatches++;
    }

    const acc = actualMatches > 0 ? Math.round((correctClicks / actualMatches) * 100) : 0;
    document.getElementById('final-stat').innerHTML = `
        ID: ${studentID}<br>
        Level: ${n}-Back<br>
        一致正解数: ${correctClicks} / ${actualMatches}<br>
        <strong style="font-size: 24px; color: #38bdf8;">正答率: ${acc}%</strong><br>
        <p id="send-status" style="font-size: 12px; margin-top:10px;">データを送信中...</p>
    `;

    // GASへデータ送信
    try {
        const response = await fetch(gasUrl, {
            method: "POST",
            mode: "no-cors",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(trialLogs)
        });
        document.getElementById('send-status').innerText = "データの送信が完了しました。";
    } catch (e) {
        document.getElementById('send-status').innerText = "送信に失敗しました。";
        console.error(e);
    }
}