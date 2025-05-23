// Variabel Global
let nodes = []; // Daftar node unik
let edges = []; // Daftar semua edge dari input {from, to, weight}
let mstResult = { mst: [], totalWeight: 0 }; // Hasil MST {mst (edges), totalWeight}
let nodePositions = {}; // Posisi node di canvas {nodeName: {x, y}}

let canvas, ctx;
let animationEnabled = true;
let isDarkMode = false;
let originalTotalWeight = 0; // Menyimpan total berat graf asli

// Fungsi untuk menginisialisasi semua saat halaman dimuat
document.addEventListener('DOMContentLoaded', () => {
    initCanvas();
    document.getElementById('currentYear').textContent = new Date().getFullYear();
    const savedTheme = localStorage.getItem('kruskalMstTheme');
    if (savedTheme === 'dark') {
        isDarkMode = false;
        toggleTheme();
    } else {
         isDarkMode = true;
         toggleTheme();
    }
    loadExample('telkom', false);
    processGraphLogic(document.getElementById('edgeData').value, false);
});

// Inisialisasi Canvas
function initCanvas() {
    canvas = document.getElementById('graphCanvas');
    if (!canvas.getContext) {
        console.error("Canvas tidak didukung oleh browser ini.");
        return;
    }
    ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    canvas.logicalWidth = rect.width;
    canvas.logicalHeight = rect.height;

    window.addEventListener('resize', () => {
        const newRect = canvas.parentElement.getBoundingClientRect();
        canvas.width = newRect.width * dpr;
        canvas.height = newRect.height * dpr;
        ctx.scale(dpr, dpr);
        canvas.logicalWidth = newRect.width;
        canvas.logicalHeight = newRect.height;
        if (nodes.length > 0) drawGraph(mstResult.mst, edges, true, null); // Gambar ulang dengan animasiEdgeInfo null
    });
}

// Toggle Tema Gelap/Terang
function toggleTheme() {
    isDarkMode = !isDarkMode;
    document.documentElement.setAttribute('data-theme', isDarkMode ? 'dark' : 'light');
    document.getElementById('theme-icon').textContent = isDarkMode ? '☀️' : '🌙';
    localStorage.setItem('kruskalMstTheme', isDarkMode ? 'dark' : 'light');
    if (nodes.length > 0) drawGraph(mstResult.mst, edges, true, null); // Gambar ulang graf dengan tema baru, animasiEdgeInfo null
}

// Struktur Data Union-Find
class UnionFind {
    constructor(nodeIds) {
        this.parent = {};
        this.rank = {};
        nodeIds.forEach(id => {
            this.parent[id] = id;
            this.rank[id] = 0;
        });
    }
    find(id) {
        if (this.parent[id] !== id) {
            this.parent[id] = this.find(this.parent[id]);
        }
        return this.parent[id];
    }
    union(id1, id2) {
        const root1 = this.find(id1);
        const root2 = this.find(id2);
        if (root1 !== root2) {
            if (this.rank[root1] < this.rank[root2]) {
                this.parent[root1] = root2;
            } else if (this.rank[root1] > this.rank[root2]) {
                this.parent[root2] = root1;
            } else {
                this.parent[root2] = root1;
                this.rank[root1]++;
            }
            return true;
        }
        return false;
    }
}

// Algoritma Kruskal
function kruskalMSTAlgorithm(uniqueNodes, allEdges) {
    const sortedEdges = [...allEdges].sort((a, b) => a.weight - b.weight);
    const uf = new UnionFind(uniqueNodes);
    const mst = [];
    let totalWeight = 0;
    for (const edge of sortedEdges) {
        if (uniqueNodes.includes(edge.from) && uniqueNodes.includes(edge.to)) {
            if (uf.union(edge.from, edge.to)) {
                mst.push(edge);
                totalWeight += edge.weight;
                if (mst.length === uniqueNodes.length - 1 && uniqueNodes.length > 0) {
                    break;
                }
            }
        }
    }
    if (uniqueNodes.length > 0 && mst.length < uniqueNodes.length - 1) {
        console.warn("Graf mungkin tidak terhubung sepenuhnya. MST yang terbentuk mungkin tidak mencakup semua node.");
    }
    return { mst, totalWeight };
}

// Parse Input Data Edges
function parseInputEdges(edgeDataText) {
    const lines = edgeDataText.trim().split('\n');
    const parsedEdges = [];
    const nodeSet = new Set();
    let parseError = null;
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        const parts = line.split(',');
        if (parts.length !== 3) {
            parseError = `Format salah pada baris ${i + 1}: "${line}". Harusnya node1,node2,weight.`;
            break;
        }
        const from = parts[0].trim();
        const to = parts[1].trim();
        const weight = parseFloat(parts[2].trim());
        if (!from || !to) {
            parseError = `Nama node tidak boleh kosong pada baris ${i + 1}: "${line}".`;
            break;
        }
        if (isNaN(weight) || weight <= 0) {
            parseError = `Bobot tidak valid (harus angka positif) pada baris ${i + 1}: "${line}".`;
            break;
        }
        parsedEdges.push({ from, to, weight, id: `e${i}` });
        nodeSet.add(from);
        nodeSet.add(to);
    }
    return { edges: parsedEdges, nodes: Array.from(nodeSet), error: parseError };
}

// Atur Posisi Node
function calculateNodePositions(nodeList, width, height) {
    const positions = {};
    if (nodeList.length === 0) return positions;
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(width, height) * 0.35;
    nodeList.forEach((node, index) => {
        if (nodeList.length === 1) {
            positions[node] = { x: centerX, y: centerY };
            return;
        }
        const angle = (2 * Math.PI * index) / nodeList.length - (Math.PI / 2);
        positions[node] = {
            x: centerX + radius * Math.cos(angle),
            y: centerY + radius * Math.sin(angle)
        };
    });
    return positions;
}

// Fungsi Utama untuk Memproses Graf
function processGraph(event) {
    if (event) event.preventDefault();
    const edgeDataText = document.getElementById('edgeData').value;
    processGraphLogic(edgeDataText, true);
}

async function processGraphLogic(edgeDataText, withAnimation) {
    const processBtn = document.getElementById('process-text');
    const loadingSpinner = document.getElementById('loading');
    const errorMessageDiv = document.getElementById('errorMessage');
    processBtn.style.display = 'none';
    loadingSpinner.style.display = 'inline-block';
    errorMessageDiv.innerHTML = '';
    const parsedData = parseInputEdges(edgeDataText);
    if (parsedData.error) {
        displayError(parsedData.error);
        processBtn.style.display = 'inline-block';
        loadingSpinner.style.display = 'none';
        return;
    }
    nodes = parsedData.nodes;
    edges = parsedData.edges;
    originalTotalWeight = edges.reduce((sum, edge) => sum + edge.weight, 0);
    if (nodes.length === 0 && edges.length > 0) {
         displayError("Data edge valid, tetapi tidak ada node yang terbentuk. Periksa format input.");
    } else if (nodes.length < 2 && edges.length > 0) {
         displayError("Graf memerlukan setidaknya 2 node untuk membentuk edge yang valid.");
    } else if (nodes.length === 0 && edges.length === 0) {
        displayError("Tidak ada data input untuk diproses.");
        processBtn.style.display = 'inline-block';
        loadingSpinner.style.display = 'none';
        ctx.clearRect(0, 0, canvas.logicalWidth, canvas.logicalHeight);
        document.getElementById('resultsCard').style.display = 'none';
        document.getElementById('exportBtn').disabled = true;
        return;
    }
    nodePositions = calculateNodePositions(nodes, canvas.logicalWidth, canvas.logicalHeight);
    if (nodes.length > 0 && edges.length > 0) {
        mstResult = kruskalMSTAlgorithm(nodes, edges);
    } else {
        mstResult = { mst: [], totalWeight: 0 };
    }
    displayResults(mstResult, originalTotalWeight);
    document.getElementById('exportBtn').disabled = false;
    if (withAnimation && animationEnabled && (edges.length > 0 || nodes.length > 0) ) { // Ditambahkan nodes.length > 0 untuk kasus hanya node
        await animateGraphBuild(mstResult.mst, edges);
    } else {
        drawGraph(mstResult.mst, edges, true, null); // Ditambahkan animasiEdgeInfo = null
    }
    processBtn.style.display = 'inline-block';
    loadingSpinner.style.display = 'none';
}

// Tampilkan Pesan Error
function displayError(message) {
    const errorMessageDiv = document.getElementById('errorMessage');
    errorMessageDiv.innerHTML = `<div class="alert alert-error">${message}</div>`;
}

// Tampilkan Hasil Perhitungan
function displayResults(result, originalWeight) {
    document.getElementById('resultsCard').style.display = 'block';
    document.getElementById('totalOriginalWeight').textContent = originalWeight.toLocaleString(undefined, {minimumFractionDigits:0, maximumFractionDigits:2});
    document.getElementById('totalMstWeight').textContent = result.totalWeight.toLocaleString(undefined, {minimumFractionDigits:0, maximumFractionDigits:2});
    document.getElementById('mstEdgeCount').textContent = result.mst.length;
    const savings = originalWeight - result.totalWeight;
    document.getElementById('savingsValue').textContent = savings.toLocaleString(undefined, {minimumFractionDigits:0, maximumFractionDigits:2});
    const efficiency = originalWeight > 0 ? ((savings / originalWeight) * 100) : 0;
    document.getElementById('efficiencyPercentage').textContent = efficiency.toFixed(1) + '%';
    const mstEdgesListDiv = document.getElementById('mstEdgesList');
    mstEdgesListDiv.innerHTML = '';
    if (result.mst.length > 0) {
        result.mst.forEach(edge => {
            const item = document.createElement('div');
            item.className = 'edge-item';
            item.innerHTML = `
                <span class="edge-connection">${edge.from} &mdash; ${edge.to}</span>
                <span class="edge-weight">${edge.weight.toLocaleString(undefined, {minimumFractionDigits:0, maximumFractionDigits:2})}</span>
            `;
            mstEdgesListDiv.appendChild(item);
        });
    } else {
        mstEdgesListDiv.innerHTML = `<p style="text-align: center; color: var(--text-secondary);">Tidak ada edge dalam MST (mungkin graf kosong atau hanya 1 node).</p>`;
    }
}

// Fungsi Menggambar Graf pada Canvas (VERSI MODIFIKASI DARI RESPONS SEBELUMNYA)
function drawGraph(currentMstEdges = [], allEdgesToDraw = [], isFinalDraw = false, animationEdgeInfo = null) {
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.logicalWidth, canvas.logicalHeight);

    const nodeRadius = Math.max(5, Math.min(10, 200 / (nodes.length || 1)));
    const lineWidth = 1.5;
    const mstLineWidth = 3;
    const fontSize = Math.max(10, Math.min(12, 150 / (nodes.length || 1)));

    const colors = {
        node: isDarkMode ? '#f1f5f9' : '#1e293b',
        nodeBorder: isDarkMode ? '#60a5fa' : '#3b82f6',
        edge: isDarkMode ? '#475569' : '#cbd5e1',
        mstEdge: '#10b981',
        text: isDarkMode ? '#e2e8f0' : '#334155',
        weightText: isDarkMode ? '#cbd5e1' : '#4b5563',
        consideringEdge: isDarkMode ? '#f59e0b' : '#f97316',
        rejectedEdge: isDarkMode ? '#ef4444' : '#dc2626',
    };

    allEdgesToDraw.forEach(edge => {
        const p1 = nodePositions[edge.from];
        const p2 = nodePositions[edge.to];
        if (!p1 || !p2) return;
        const isMstCandidate = currentMstEdges.some(me => me.id === edge.id);
        if (isFinalDraw && !isMstCandidate) {
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.strokeStyle = colors.edge;
            ctx.lineWidth = lineWidth;
            ctx.globalAlpha = 0.3;
            ctx.stroke();
            ctx.globalAlpha = 1.0;
        } else if (!isFinalDraw && !isMstCandidate) {
            let currentEdgeStyle = colors.edge;
            let currentEdgeLineWidth = lineWidth;
            let currentEdgeAlpha = 0.5;
            ctx.setLineDash([]);
            if (animationEdgeInfo && animationEdgeInfo.edge.id === edge.id) {
                if (animationEdgeInfo.type === 'considering') {
                    currentEdgeStyle = colors.consideringEdge;
                    currentEdgeLineWidth = mstLineWidth - 0.5;
                    currentEdgeAlpha = 0.9;
                    ctx.setLineDash([5, 3]);
                } else if (animationEdgeInfo.type === 'rejected') {
                    currentEdgeStyle = colors.rejectedEdge;
                    currentEdgeLineWidth = mstLineWidth - 0.5;
                    currentEdgeAlpha = 0.9;
                }
            }
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.strokeStyle = currentEdgeStyle;
            ctx.lineWidth = currentEdgeLineWidth;
            ctx.globalAlpha = currentEdgeAlpha;
            ctx.stroke();
            ctx.globalAlpha = 1.0;
            ctx.setLineDash([]);
        }
    });

    currentMstEdges.forEach(edge => {
        const p1 = nodePositions[edge.from];
        const p2 = nodePositions[edge.to];
        if (!p1 || !p2) return;
        let currentMstEdgeStyle = colors.mstEdge;
        let currentMstEdgeLineWidth = mstLineWidth;
        if (!isFinalDraw && animationEdgeInfo && animationEdgeInfo.edge.id === edge.id && animationEdgeInfo.type === 'accepted_flash') {
            currentMstEdgeLineWidth = mstLineWidth + 1;
        }
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.strokeStyle = currentMstEdgeStyle;
        ctx.lineWidth = currentMstEdgeLineWidth;
        ctx.globalAlpha = 1.0;
        ctx.stroke();
        if (nodes.length <= 25 || isFinalDraw) {
            ctx.fillStyle = isDarkMode ? colors.mstEdge : '#047857';
            ctx.font = `bold ${fontSize * 0.85}px Arial`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            const midX = (p1.x + p2.x) / 2;
            const midY = (p1.y + p2.y) / 2;
            const textOffset = nodeRadius * 1.5;
            const angleText = Math.atan2(p2.y - p1.y, p2.x - p1.x);
            let textX = midX + textOffset * Math.sin(angleText);
            let textY = midY - textOffset * Math.cos(angleText);
            const dist = Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
            if (dist < nodeRadius * 4) {
                textX = midX + (nodeRadius + 5) * Math.sin(angleText);
                textY = midY - (nodeRadius + 5) * Math.cos(angleText);
            }
            ctx.fillText(edge.weight.toLocaleString(undefined, {minimumFractionDigits:0, maximumFractionDigits:1}), textX, textY);
        }
    });

    nodes.forEach(nodeId => {
        const pos = nodePositions[nodeId];
        if (!pos) return;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, nodeRadius, 0, 2 * Math.PI);
        ctx.fillStyle = colors.node;
        ctx.fill();
        ctx.strokeStyle = colors.nodeBorder;
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.fillStyle = colors.text;
        ctx.font = `${fontSize}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(nodeId, pos.x, pos.y);
    });
}


// Animasi Pembangunan Graf (VERSI MODIFIKASI DARI RESPONS SEBELUMNYA)
async function animateGraphBuild(finalMstEdges, allGraphEdges) {
    if (!animationEnabled || !ctx) {
        drawGraph(finalMstEdges, allGraphEdges, true, null);
        return;
    }
    const sortedAllEdges = [...allGraphEdges].sort((a, b) => a.weight - b.weight);
    let currentMstForAnimation = [];
    const uf = new UnionFind(nodes);
    drawGraph([], allGraphEdges, false, null);
    await new Promise(resolve => setTimeout(resolve, 300));
    for (const edge of sortedAllEdges) {
        if (nodes.length === 0) break;
        drawGraph(currentMstForAnimation, allGraphEdges, false, { edge: edge, type: 'considering' });
        await new Promise(resolve => setTimeout(resolve, animationEnabled ? 450 : 5));
        if (uf.union(edge.from, edge.to)) {
            currentMstForAnimation.push(edge);
            drawGraph(currentMstForAnimation, allGraphEdges, false, { edge: edge, type: 'accepted_flash' });
            await new Promise(resolve => setTimeout(resolve, animationEnabled ? 550 : 10));
            drawGraph(currentMstForAnimation, allGraphEdges, false, null);
        } else {
            drawGraph(currentMstForAnimation, allGraphEdges, false, { edge: edge, type: 'rejected' });
            await new Promise(resolve => setTimeout(resolve, animationEnabled ? 650 : 5));
            drawGraph(currentMstForAnimation, allGraphEdges, false, null);
            await new Promise(resolve => setTimeout(resolve, animationEnabled ? 250 : 5));
        }
        if (currentMstForAnimation.length === nodes.length - 1 && nodes.length > 0) {
            break;
        }
    }
    drawGraph(finalMstEdges, allGraphEdges, true, null);
}

// Muat Data Contoh
function loadExample(type, autoProcess = true) {
    const edgeDataTextArea = document.getElementById('edgeData');
    if (type === 'telkom') {
        edgeDataTextArea.value = `STO,ODC,1890\nODC,ODP-FB27,1320\nODC,ODP-FB28,1080\nODC,ODP-FB29,907\nODC,ODP-FB30,809\nODC,ODP-FB31,708\nODC,ODP-FB32,702\nODC,ODP-FB33,263\nODP-FB27,P1,40\nODP-FB27,P2,48\nODP-FB27,P3,30\nODP-FB28,P2,158\nODP-FB30,P4,50\nODP-FB30,P5,121\nODP-FB31,P4,110\nODP-FB31,P5,87\nODP-FB32,P6,80\nODP-FB32,P7,50\nODP-FB32,P8,150\nODP-FB33,P8,80`;
    } else if (type === 'simple') {
        edgeDataTextArea.value = `A,B,4\nA,C,2\nB,C,1\nB,D,5\nC,D,8\nC,E,10\nD,E,2\nD,F,6\nE,F,3`;
    }
    if (autoProcess) {
        processGraphLogic(edgeDataTextArea.value, true);
    }
}

// Bersihkan Semua Input dan Hasil
function clearAll() {
    document.getElementById('edgeData').value = '';
    nodes = [];
    edges = [];
    mstResult = { mst: [], totalWeight: 0 };
    nodePositions = {};
    originalTotalWeight = 0;
    if (ctx) ctx.clearRect(0, 0, canvas.logicalWidth, canvas.logicalHeight);
    document.getElementById('resultsCard').style.display = 'none';
    document.getElementById('errorMessage').innerHTML = '';
    document.getElementById('exportBtn').disabled = true;
}

// Toggle Animasi
function toggleAnimation() {
    animationEnabled = !animationEnabled;
    document.getElementById('animToggleBtn').textContent = `⚡ Animasi: ${animationEnabled ? 'Aktif' : 'Nonaktif'}`;
}

// Tampilkan Konten Contoh (Tab)
function showExampleContent(type, clickedTab) {
    const contents = document.querySelectorAll('.example-content');
    contents.forEach(c => c.classList.remove('active'));
    document.getElementById(`example-${type}`).classList.add('active');
    const tabs = document.querySelectorAll('.example-tab');
    tabs.forEach(t => t.classList.remove('active'));
    if (clickedTab) clickedTab.classList.add('active');
}

// Ekspor Hasil
function exportResults() {
    if (mstResult.mst.length === 0 && originalTotalWeight === 0) {
        alert("Tidak ada hasil untuk diekspor.");
        return;
    }
    let textContent = "Hasil Optimasi Jaringan Kruskal MST\n";
    textContent += "====================================\n\n";
    textContent += `Total Berat Graf Asli: ${originalTotalWeight.toLocaleString(undefined, {minimumFractionDigits:0, maximumFractionDigits:2})}\n`;
    textContent += `Total Berat MST: ${mstResult.totalWeight.toLocaleString(undefined, {minimumFractionDigits:0, maximumFractionDigits:2})}\n`;
    textContent += `Jumlah Edge dalam MST: ${mstResult.mst.length}\n`;
    const savings = originalTotalWeight - mstResult.totalWeight;
    textContent += `Penghematan: ${savings.toLocaleString(undefined, {minimumFractionDigits:0, maximumFractionDigits:2})}\n`;
    const efficiency = originalTotalWeight > 0 ? ((savings / originalTotalWeight) * 100) : 0;
    textContent += `Efisiensi: ${efficiency.toFixed(1)}%\n\n`;
    textContent += "Edge dalam Minimum Spanning Tree:\n";
    if (mstResult.mst.length > 0) {
        mstResult.mst.forEach(edge => {
            textContent += `- ${edge.from} -- ${edge.to} (Bobot: ${edge.weight.toLocaleString(undefined, {minimumFractionDigits:0, maximumFractionDigits:2})})\n`;
        });
    } else {
        textContent += "- Tidak ada edge dalam MST.\n";
    }
    const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'hasil_kruskal_mst.txt';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
}