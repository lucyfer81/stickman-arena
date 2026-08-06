const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}

window.addEventListener('resize', resize);
resize();

function loop() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    requestAnimationFrame(loop);
}

loop();