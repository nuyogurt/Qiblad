/* =====================================================
   INTI PERHITUNGAN (tanpa DOM)
   ===================================================== */
const r5 = x => Math.round(x * 1e5) / 1e5;
const rad = d => d * Math.PI / 180, deg = r => r * 180 / Math.PI;
const norm360 = a => ((a % 360) + 360) % 360;
const normLng = d => ((d + 180) % 360 + 360) % 360 - 180;   // ke rentang [-180, 180)
const normDiff = d => { d = norm360(d); return d > 180 ? d - 360 : d; };  // ke rentang (-180, 180]

const KAABA = {
  lat: r5(21 + 25/60 + 21.03/3600),
  lng: r5(39 + 49/60 + 34.33/3600)
};

/* Desimal -> DMS. Dihitung dalam bilangan bulat per 1/100 detik supaya
   galat floating point (mis. 140.7 -> 140.69999...) tidak menghasilkan detik 60 atau menit 41 yang keliru. */
const toDMS = v => {
  const cs = Math.round(Math.abs(v) * 360000);          // 1/100 detik busur
  const d = Math.floor(cs / 360000), sisa = cs - d * 360000;
  const m = Math.floor(sisa / 6000);
  return {d, m, s: (sisa - m * 6000) / 100};
};
const fmtDMS = (o, suffix) => `${o.d}° ${o.m}' ${o.s}"` + (suffix ? ` ${suffix}` : "");

/* Arah kiblat dengan rumus segitiga bola.
   Selisih bujur dinormalisasi ke -180..180 supaya lokasi di Pasifik
   (Hawaii, Samoa, Alaska barat) tidak salah arah. */
function hitungKiblat(lat, lng){
  const dl = normLng(lng - KAABA.lng);          // > 0: tempat di timur Ka'bah
  const C = r5(Math.abs(dl));
  const a = 90 - lat, b = 90 - KAABA.lat;
  const timur = dl > 0;
  const hasil = {lat, lng, dl, C, a, b, timur, bujurRaw: r5(Math.abs(lng - KAABA.lng))};
  const sinA0 = Math.sin(rad(a));

  if (C === 0 || C === 180 || Math.abs(sinA0) < 1e-9) {
    let az;
    if (Math.abs(sinA0) < 1e-9) az = lat > 0 ? 180 : 0;            // di kutub
    else if (C === 180) az = (lat + KAABA.lat) > 0 ? 0 : 180;       // bujur berseberangan: lewat kutub terdekat
    else az = lat > KAABA.lat ? 180 : 0;                            // satu bujur dengan Ka'bah
    return {...hasil, special: true, B: az, az,
      rumus: az === 180 ? "Lurus ke Selatan (180°)" : "Lurus ke Utara (0°)"};
  }

  const sinA = r5(sinA0), cosA = r5(Math.cos(rad(a)));
  const cotb = r5(1 / Math.tan(rad(b)));
  const sinC = r5(Math.sin(rad(C))), cotC = r5(1 / Math.tan(rad(C)));
  const cotB = r5((cotb * sinA) / sinC - cosA * cotC);
  let B = r5(deg(cotB === 0 ? Math.PI / 2 : Math.atan(1 / cotB)));
  if (B < 0) B += 180;
  // B selalu diukur dari Utara menuju sisi Ka'bah:
  // tempat di timur Ka'bah -> kiblat ke barat (360° - B), di barat Ka'bah -> kiblat ke timur (B)
  const az = r5(timur ? 360 - B : B);
  return {...hasil, special: false, sinA, cosA, cotb, sinC, cotC, cotB, B, az,
    rumus: timur ? "360° - B" : "B"};
}

/* Notasi arah dari B: dari Utara/Selatan dan dari Barat/Timur */
function notasiArah(B, timur){
  const sisi = timur ? "Barat" : "Timur";
  const dariUtara = `${B.toFixed(2)}° dari Utara ke ${sisi}`;
  const alt = B <= 90 ? `${(90 - B).toFixed(2)}° dari ${sisi} ke Utara`
                      : `${(B - 90).toFixed(2)}° dari ${sisi} ke Selatan`;
  return {dariUtara, alt, sisi};
}

/* =====================================================
   UI
   ===================================================== */
const $ = id => document.getElementById(id);
const CITY_GROUPS = {
  "Indonesia": {
    "Yogyakarta":[-7.78333,110.36667], "Jakarta":[-6.2,106.81667], "Surabaya":[-7.25,112.75],
    "Medan":[3.58333,98.66667], "Makassar":[-5.14,119.41], "Denpasar":[-8.65,115.21667], "Jayapura":[-2.53,140.7]
  },
  "Dunia (barat Ka'bah dan selisih bujur > 180°)": {
    "Kairo":[30.0444,31.2357], "London":[51.5074,-0.1278], "New York":[40.7128,-74.006], "Honolulu":[21.3069,-157.8583]
  }
};
const CITIES = Object.assign({}, ...Object.values(CITY_GROUPS));
/* Lokasi tambahan untuk soal latihan: campuran timur/barat Ka'bah dan belahan utara/selatan */
const PRACTICE = Object.assign({}, CITIES, {
  "Banda Aceh":[5.5483,95.3238], "Pontianak":[-0.0263,109.3425], "Kuala Lumpur":[3.139,101.6869],
  "Tokyo":[35.6762,139.6503], "Sydney":[-33.8688,151.2093], "Istanbul":[41.0082,28.9784],
  "Cape Town":[-33.9249,18.4241], "Rio de Janeiro":[-22.9068,-43.1729]
});
let mode = "DMS";
let qiblaAz = null;   // azimuth kiblat hasil hitung terakhir
let lastHasil = null; // {k, lat, lng} hasil hitung terakhir, dipakai panel latihan dan salin hasil

(function gambarSkala(){
  let h = "";
  const names = {0:"U",45:"TL",90:"T",135:"TG",180:"S",225:"BD",270:"B",315:"BL"};
  for (let a = 0; a < 360; a += 5) {
    const major = a % 45 === 0, mid = a % 15 === 0;
    const r1 = 168, r2 = major ? 150 : mid ? 157 : 162;
    const s = Math.sin(rad(a)), c = -Math.cos(rad(a));
    h += `<line x1="${200+r1*s}" y1="${200+r1*c}" x2="${200+r2*s}" y2="${200+r2*c}" stroke="var(--mute)" stroke-width="${major?2:1}"/>`;
    if (major) h += `<text x="${200+186*s}" y="${200+186*c}" text-anchor="middle" dominant-baseline="central" font-size="${a%90===0?15:11}" font-weight="600" fill="var(--ink)" font-family="Instrument Sans,sans-serif">${names[a]}</text>`;
  }
  $("ticks").innerHTML = h;
})();

function setMode(m){
  mode = m;
  $("tDMS").setAttribute("aria-selected", m === "DMS");
  $("tDEC").setAttribute("aria-selected", m === "DEC");
  $("fDMS").hidden = m !== "DMS"; $("fDEC").hidden = m !== "DEC";
}
$("tDMS").onclick = () => setMode("DMS");
$("tDEC").onclick = () => setMode("DEC");

function isiKoordinat(lat, lng){
  $("latX").value = lat; $("lngX").value = lng;
  const a = toDMS(lat), b = toDMS(lng);
  $("latDir").value = lat < 0 ? "S" : "U"; $("latD").value = a.d; $("latM").value = a.m; $("latS").value = a.s;
  $("lngDir").value = lng < 0 ? "B" : "T"; $("lngD").value = b.d; $("lngM").value = b.m; $("lngS").value = b.s;
}
/* ---------- contoh kota, urungkan, dan lokasi saya ---------- */
const FIELD_IDS = ["latDir", "latD", "latM", "latS", "lngDir", "lngD", "lngM", "lngS", "latX", "lngX"];
let undoInfo = null, toastTimer = null;
const ambilIsian = () => ({mode, v: FIELD_IDS.map(id => $(id).value)});
function pulihkanIsian(s){ FIELD_IDS.forEach((id, i) => { $(id).value = s.v[i]; }); setMode(s.mode); }
function tampilToast(pesan, undo){
  undoInfo = undo; $("toastMsg").textContent = pesan; $("toast").hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { $("toast").hidden = true; undoInfo = null; }, 9000);
}
$("undoBtn").onclick = () => {
  if (!undoInfo) return;
  pulihkanIsian(undoInfo.sebelum); $("err").textContent = "";
  if (undoInfo.hitungUlang) hitung();
  else { $("readout").classList.remove("usang"); $("svg").classList.remove("usang"); }
  $("toast").hidden = true; undoInfo = null;
};
$("citySel").innerHTML = '<option value="">Isi dengan contoh kota…</option>' + Object.entries(CITY_GROUPS)
  .map(([grup, kota]) => `<optgroup label="${grup}">${Object.keys(kota).map(n => `<option>${n}</option>`).join("")}</optgroup>`).join("");
$("citySel").onchange = e => {
  const nama = e.target.value;
  if (!nama) return;
  const sebelum = ambilIsian(), [la, ln] = CITIES[nama];
  isiKoordinat(la, ln); e.target.value = ""; $("err").textContent = "";
  if (qiblaAz !== null) { $("readout").classList.add("usang"); $("svg").classList.add("usang"); }   // hasil lama belum diperbarui
  tampilToast(`Koordinat ${nama} terisi. Tekan "Hitung arah kiblat" untuk melihat hasilnya.`, {sebelum, hitungUlang: false});
};
$("geo").onclick = () => {
  if (!navigator.geolocation) { $("err").textContent = "Browser ini tidak mendukung geolokasi."; return; }
  $("geo").textContent = "Mencari lokasi…";
  navigator.geolocation.getCurrentPosition(p => {
    $("geo").textContent = "Pakai lokasi saya";
    const sebelum = ambilIsian();
    isiKoordinat(r5(p.coords.latitude), r5(p.coords.longitude));
    hitung();
    tampilToast("Koordinat diisi dari lokasi perangkat.", {sebelum, hitungUlang: true});
  }, () => {
    $("geo").textContent = "Pakai lokasi saya";
    $("err").textContent = "Lokasi tidak bisa diakses. Izinkan akses lokasi atau isi koordinat manual.";
  }, {timeout: 10000});
};
/* ---------- tema warna dan mode terang/gelap (disimpan di perangkat ini saja) ---------- */
const TEMA = ["hijau", "biru", "ungu", "terakota", "grafit"];
const simpanPref = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* penyimpanan tidak tersedia */ } };
const bacaPref = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
function terapkanMode(mode){
  document.documentElement.dataset.theme = mode;
  $("themeBtn").textContent = mode === "dark" ? "Mode terang" : "Mode gelap";
}
function terapkanTema(tema){
  if (!TEMA.includes(tema)) tema = "hijau";
  document.documentElement.dataset.tema = tema;
  document.querySelectorAll(".swatch").forEach(b => b.setAttribute("aria-checked", String(b.dataset.tema === tema)));
}
$("themeBtn").onclick = () => {
  const mode = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  terapkanMode(mode); simpanPref("qiblad.mode", mode);
};
document.querySelector(".swatches").onclick = e => {
  const b = e.target.closest(".swatch");
  if (!b) return;
  terapkanTema(b.dataset.tema); simpanPref("qiblad.tema", b.dataset.tema);
};
terapkanMode(bacaPref("qiblad.mode") || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"));
terapkanTema(bacaPref("qiblad.tema"));
$("go").onclick = () => hitung();
document.addEventListener("keydown", e => {
  if (e.key !== "Enter" || e.target.tagName !== "INPUT") return;
  if (e.target.closest("#inPanel")) hitung();          // hanya kolom koordinat yang memicu hitung
  else if (e.target.closest("#cekGrid")) periksa();    // kolom latihan memicu pemeriksaan
});

/* ---------- pembangun persamaan MathML ---------- */
const MX = {
  n: x => { const v = String(x); return v.startsWith("-") ? `<mo>−</mo><mn>${v.slice(1)}</mn>` : `<mn>${v}</mn>`; },
  i: x => `<mi>${x}</mi>`, f: x => `<mi mathvariant="normal">${x}</mi>`, o: x => `<mo>${x}</mo>`, t: x => `<mtext>${x}</mtext>`,
  r: (...a) => `<mrow>${a.join("")}</mrow>`,
  sub: (b, s) => `<msub>${b}${s}</msub>`, frac: (a, b) => `<mfrac>${a}${b}</mfrac>`,
  p: x => `<mo lspace="0" rspace="0">(</mo>${x}<mo lspace="0" rspace="0">)</mo>`,
  res: x => `<mstyle class="res">${x}</mstyle>`
};
MX.g = x => MX.n(x) + `<mo lspace="0" rspace="0">°</mo>`;                                  // angka dengan tanda derajat
MX.fn = (nama, arg) => MX.f(nama) + "<mo>&#x2061;</mo>" + MX.p(arg);                       // fungsi, mis. sin(a)
MX.dms = o => MX.n(o.d) + `<mo lspace="0" rspace="0">°</mo>` + MX.n(o.m) + `<mo lspace="0" rspace="0">′</mo>` + MX.n(o.s) + `<mo lspace="0" rspace="0">″</mo>`;
const eq = (kiri, kanan) => `<mtr class="mulai"><mtd>${kiri}</mtd><mtd><mo>=</mo>${kanan}</mtd></mtr>`;      // baris persamaan
const lanjut = kanan => `<mtr><mtd></mtd><mtd><mo>=</mo>${kanan}</mtd></mtr>`;                // baris lanjutan, tanda = sejajar
const tabel = baris => `<div class="eqwrap"><math><mtable>${baris.join("")}</mtable></math></div>`;
const cotBNegatif = k => k.cotB < 0;   // arkus kotangen negatif -> B ditambah 180°

function bacaInput(){
  let lat, lng, info = {};
  if (mode === "DMS") {
    const v = id => parseFloat($(id).value), z = id => $(id).value.trim() === "" ? 0 : parseFloat($(id).value);   // menit/detik kosong dianggap 0
    const d1 = v("latD"), m1 = z("latM"), s1 = z("latS"), d2 = v("lngD"), m2 = z("lngM"), s2 = z("lngS");
    if (isNaN(d1) || isNaN(d2)) throw "Isi derajat lintang dan bujur terlebih dahulu.";
    if ([m1,s1,m2,s2].some(isNaN)) throw "Menit dan detik harus berupa angka.";
    if (m1 >= 60 || m2 >= 60 || s1 >= 60 || s2 >= 60 || [d1,m1,s1,d2,m2,s2].some(x => x < 0)) throw "Menit dan detik harus 0–59,99 dan tidak boleh negatif.";
    lat = r5(d1 + m1/60 + s1/3600); lng = r5(d2 + m2/60 + s2/3600);
    const aL = $("latDir").value, aB = $("lngDir").value;
    if (aL === "S") lat = -lat;
    if (aB === "B") lng = -lng;
    info = {dms:true, aL, aB, d1, m1, s1, d2, m2, s2};
  } else {
    lat = parseFloat($("latX").value); lng = parseFloat($("lngX").value);
    if (isNaN(lat) || isNaN(lng)) throw "Isi lintang dan bujur dalam angka desimal.";
    info = {dms:false, aL: lat < 0 ? "S" : "U", aB: lng < 0 ? "B" : "T"};
  }
  if (Math.abs(lat) > 90) throw "Lintang harus antara −90° dan 90°.";
  if (Math.abs(lng) > 180) throw "Bujur harus antara −180° dan 180°.";
  return {lat, lng, info};
}

function hitung(tutup){            // tutup === true: hitung diam-diam untuk soal latihan
  $("err").textContent = "";
  setTertutup(tutup === true);
  if (tutup !== true) $("soalInfo").hidden = true;
  $("readout").classList.remove("usang"); $("svg").classList.remove("usang");
  if (undoInfo && !undoInfo.hitungUlang) { $("toast").hidden = true; undoInfo = null; }   // pesan "tekan Hitung" sudah tidak relevan
  let inp;
  try { inp = bacaInput(); } catch (e) { $("err").textContent = e; return; }
  const {lat, lng, info} = inp;
  const k = hitungKiblat(lat, lng);
  const {az, B, special} = k;
  qiblaAz = az; $("svg").classList.remove("kosong");
  const azD = toDMS(az), BD = toDMS(B);
  const n = notasiArah(B, k.timur);
  const rel = special ? "Lurus" : k.timur ? "Barat (U-B)" : "Timur (U-T)";

  $("readout").innerHTML = `
    <div class="stat main"><small>Azimuth kiblat (dari Utara sejati, searah jarum jam)</small><b>${az.toFixed(4)}°</b><small>${fmtDMS(azD)}</small></div>
    <div class="stat"><small>Sudut B</small><b>${B.toFixed(4)}°</b><small>${fmtDMS(BD)}</small></div>
    <div class="stat"><small>Arah dari Utara</small><b>${rel}</b><small>${special ? "satu bujur dengan Ka'bah" : n.dariUtara + "<br>" + n.alt}</small></div>`;

  const needle = $("needle");
  needle.style.transform = "rotate(0deg)";
  requestAnimationFrame(() => requestAnimationFrame(() => needle.style.transform = `rotate(${az}deg)`));
  const R = 168, x = 200 + R * Math.sin(rad(az)), y = 200 - R * Math.cos(rad(az));
  $("arc").setAttribute("d", az === 0 ? "" : `M200 200 L200 ${200-R} A${R} ${R} 0 ${az > 180 ? 1 : 0} 1 ${x} ${y} Z`);
  lastHasil = {k, lat, lng};
  gambarSudutB(k);
  $("copyBtn").hidden = false; $("stepBar").hidden = false;
  bersihkanTanda();   // tanda benar/salah lama mengacu ke hitungan sebelumnya

  /* langkah perhitungan (persamaan MathML) */
  const S = [], bagian = (judul, isi) => S.push(`<section><div class="h">${judul}</div>${isi}</section>`);
  const catatan = t => `<p class="catatan">${t}</p>`;
  const nilaiPhi = ph => MX.sub(MX.i("φ"), MX.i(ph)), nilaiLam = ph => MX.sub(MX.i("λ"), MX.i(ph));
  const pecahan = (d, m, sd) => MX.n(d) + MX.o("+") + MX.frac(MX.n(m), MX.n(60)) + MX.o("+") + MX.frac(MX.n(sd), MX.n(3600));

  const data = [
    eq(nilaiPhi("k"), MX.dms({d: 21, m: 25, s: 21.03}) + MX.t("&#160;LU")),
    lanjut(pecahan(21, 25, 21.03)), lanjut(MX.g(KAABA.lat)),
    eq(nilaiLam("k"), MX.dms({d: 39, m: 49, s: 34.33}) + MX.t("&#160;BT")),
    lanjut(pecahan(39, 49, 34.33)), lanjut(MX.g(KAABA.lng))
  ];
  if (info.dms) {
    data.push(eq(nilaiPhi("t"), MX.dms({d: info.d1, m: info.m1, s: info.s1}) + MX.t("&#160;L" + info.aL)),
      lanjut(pecahan(info.d1, info.m1, info.s1)), lanjut(MX.g(lat)),
      eq(nilaiLam("t"), MX.dms({d: info.d2, m: info.m2, s: info.s2}) + MX.t("&#160;B" + info.aB)),
      lanjut(pecahan(info.d2, info.m2, info.s2)), lanjut(MX.g(lng)));
  } else {
    data.push(eq(nilaiPhi("t"), MX.g(lat)), lanjut(MX.dms(toDMS(lat)) + MX.t("&#160;L" + info.aL)),
      eq(nilaiLam("t"), MX.g(lng)), lanjut(MX.dms(toDMS(lng)) + MX.t("&#160;B" + info.aB)));
  }
  bagian("Data diketahui", tabel(data));

  const bar = x => `<mo lspace="0" rspace="0" stretchy="false">|</mo>${x}<mo lspace="0" rspace="0" stretchy="false">|</mo>`;
  bagian("Sudut segitiga bola", tabel([
    eq(MX.i("a"), MX.g(90) + MX.o("−") + nilaiPhi("t")), lanjut(MX.g(90) + MX.o("−") + MX.p(MX.g(lat))), lanjut(MX.g(r5(k.a))),
    eq(MX.i("b"), MX.g(90) + MX.o("−") + nilaiPhi("k")), lanjut(MX.g(90) + MX.o("−") + MX.p(MX.g(KAABA.lat))), lanjut(MX.g(r5(k.b))),
    eq(MX.i("C"), bar(nilaiLam("t") + MX.o("−") + nilaiLam("k"))),
    lanjut(bar(MX.p(MX.g(lng)) + MX.o("−") + MX.p(MX.g(KAABA.lng)))), lanjut(MX.g(k.C))
  ]) + (k.bujurRaw > 180 ? catatan(`Selisih bujur ${k.bujurRaw}° melebihi 180°, sehingga dinormalisasi lewat sisi terpendek: 360° − ${k.bujurRaw}° = ${k.C}°.`) : ""));

  if (special) {
    bagian("Kasus khusus", catatan("Tempat berada pada bujur yang sama atau berseberangan dengan Ka'bah, atau di kutub, sehingga arah kiblat lurus ke utara atau selatan.")
      + tabel([eq(MX.t("Azimuth"), MX.t(k.rumus)), lanjut(MX.res(MX.g(az))), lanjut(MX.dms(azD))]));
  } else {
    const tri = (nama, v, sudut, hasil) => eq(MX.fn(nama, MX.i(v)), MX.fn(nama, MX.g(sudut)) + MX.o("=") + MX.n(hasil));
    bagian("Nilai trigonometri", tabel([
      tri("sin", "a", r5(k.a), k.sinA), tri("cos", "a", r5(k.a), k.cosA), tri("cot", "b", r5(k.b), k.cotb),
      tri("sin", "C", k.C, k.sinC), tri("cot", "C", k.C, k.cotC)
    ]));
    const cot = v => MX.fn("cot", MX.i(v)), simb = (f, v) => MX.fn(f, MX.i(v));   // notasi seragam: sin(a), cot(B), dst.
    const kali = (x, y) => x + MX.o("×") + y;
    const suku1 = r5(k.cotb * k.sinA), suku2 = r5(k.cosA * k.cotC);
    bagian("Cotangen sudut B", tabel([
      eq(cot("B"), MX.frac(MX.r(kali(cot("b"), simb("sin", "a"))), MX.r(simb("sin", "C"))) + MX.o("−") + MX.r(kali(simb("cos", "a"), cot("C")))),
      lanjut(MX.frac(MX.r(kali(MX.n(k.cotb), MX.n(k.sinA))), MX.n(k.sinC)) + MX.o("−") + MX.p(kali(MX.n(k.cosA), MX.n(k.cotC)))),
      lanjut(MX.frac(MX.n(suku1), MX.n(k.sinC)) + MX.o("−") + MX.p(MX.n(suku2))),
      lanjut(MX.n(r5(suku1 / k.sinC)) + MX.o("−") + MX.p(MX.n(suku2))),
      lanjut(MX.res(MX.n(k.cotB)))
    ]));
    bagian("Sudut B", tabel([
      eq(MX.i("B"), MX.f("arccot") + "<mo>&#x2061;</mo>" + MX.p(MX.n(k.cotB))), lanjut(MX.res(MX.g(B))), lanjut(MX.dms(BD))
    ]) + (cotBNegatif(k) ? catatan("Sudut B hasil arkus kotangen bernilai negatif, sehingga ditambah 180°.") : ""));
    bagian("Azimuth", catatan(`Tempat berada di ${k.timur ? "timur" : "barat"} Ka'bah, sehingga rumus Azimuth yang dipakai adalah ${k.rumus}.`)
      + tabel(k.timur
        ? [eq(MX.t("Azimuth"), MX.g(360) + MX.o("−") + MX.i("B")), lanjut(MX.g(360) + MX.o("−") + MX.g(B)), lanjut(MX.res(MX.g(az))), lanjut(MX.dms(azD))]
        : [eq(MX.t("Azimuth"), MX.i("B")), lanjut(MX.res(MX.g(az))), lanjut(MX.dms(azD))]));
  }
  $("steps").innerHTML = S.join("");
  $("stepsPanel").hidden = false;
  perbaruiLive();
}

/* ---------- kompas langsung (sensor arah perangkat) ---------- */
let live = {aktif: false, arah: null};
let liveHalus = 0, liveGulung = 0, liveAdaData = false, liveTimer = null, adaAbsolut = false;
const deklinasi = () => parseFloat($("decl").value) || 0;

/* Arah bagian atas layar HP, derajat dari utara magnetik searah jarum jam. null jika sensor tidak mutlak. */
function arahDariSensor(e){
  if (typeof e.webkitCompassHeading === "number") return e.webkitCompassHeading;       // iOS (sudah dikompensasi kemiringan)
  if (e.alpha === null || e.alpha === undefined) return null;
  if (!(e.absolute || e.type === "deviceorientationabsolute")) return null;            // sensor relatif tidak tahu arah utara
  const a = rad(e.alpha), b = rad(e.beta || 0), g = rad(e.gamma || 0);
  if (Math.abs(Math.cos(b)) > 0.35)                                                    // HP mendatar atau agak miring: tepi atas HP
    return norm360(deg(Math.atan2(-Math.sin(a) * Math.cos(b), Math.cos(a) * Math.cos(b))));
  const vx = -Math.cos(a) * Math.sin(g) - Math.sin(a) * Math.sin(b) * Math.cos(g);     // HP hampir tegak: arah belakang HP
  const vy = -Math.sin(a) * Math.sin(g) + Math.cos(a) * Math.sin(b) * Math.cos(g);
  return norm360(deg(Math.atan2(vx, vy)));
}

function putarKompas(h){            // h: arah sejati HP
  if (!liveAdaData) { liveAdaData = true; liveHalus = h; liveGulung = h; }
  else { const d = normDiff(h - liveHalus) * 0.25; liveHalus = norm360(liveHalus + d); liveGulung += d; }  // peredam getaran sensor
  live.arah = liveHalus;
  $("dial").style.transform = `rotate(${-liveGulung}deg)`;
  perbaruiLive();
}

function perbaruiLive(){
  if (!live.aktif || live.arah === null || qiblaAz === null) return;
  const sel = normDiff(qiblaAz - live.arah), ok = Math.abs(sel) <= 3, st = $("liveStatus");
  st.hidden = false; st.classList.toggle("ok", ok); $("svg").classList.toggle("hadap", ok);
  st.innerHTML = ok ? `<b>Menghadap kiblat</b> (selisih ${Math.abs(sel).toFixed(1)}°)`
    : `Arah HP <b>${Math.round(live.arah)}°</b>. Putar badan ${Math.abs(Math.round(sel))}° ke ${sel > 0 ? "kanan" : "kiri"} sampai jarum hijau berada di atas.`;
}

function onSensor(e){
  if (e.type === "deviceorientationabsolute") {
    if (e.alpha === null || e.alpha === undefined) return;   // beberapa browser mengirim event kosong saat listener dipasang
    adaAbsolut = true;
  } else if (adaAbsolut) return;                              // sudah ada sensor mutlak, abaikan yang relatif
  const h = arahDariSensor(e);
  if (h === null) return;
  if (!liveAdaData) { clearTimeout(liveTimer); $("liveMsg").textContent = ""; }
  putarKompas(norm360(h + deklinasi()));
}

async function aktifkanLive(){
  const msg = $("liveMsg"); msg.textContent = "";
  if (qiblaAz === null) { msg.textContent = "Hitung arah kiblat dulu (isi koordinat lalu tekan Hitung), baru aktifkan kompas langsung."; return; }
  if (!("DeviceOrientationEvent" in window)) { msg.textContent = "Browser atau perangkat ini tidak mendukung sensor arah. Kompas langsung umumnya hanya tersedia di HP."; return; }
  try {
    if (typeof DeviceOrientationEvent.requestPermission === "function") {              // iOS meminta izin lewat tombol
      if (await DeviceOrientationEvent.requestPermission() !== "granted") { msg.textContent = "Izin sensor ditolak. Izinkan akses gerakan dan orientasi pada pengaturan browser, lalu coba lagi."; return; }
    }
  } catch (err) { msg.textContent = "Izin sensor tidak dapat diminta. Pastikan halaman dibuka lewat HTTPS."; return; }
  live = {aktif: true, arah: null}; liveAdaData = false; adaAbsolut = false;
  window.addEventListener("deviceorientationabsolute", onSensor);
  window.addEventListener("deviceorientation", onSensor);
  $("liveBtn").textContent = "Matikan kompas langsung"; $("liveOpts").hidden = false; $("svg").classList.add("live");
  msg.textContent = "Menunggu data sensor…";
  liveTimer = setTimeout(() => { if (!liveAdaData) msg.textContent = "Tidak ada data sensor arah. Kompas langsung hanya berfungsi di HP, lewat HTTPS, dengan izin sensor aktif."; }, 3000);
}
function matikanLive(){
  window.removeEventListener("deviceorientationabsolute", onSensor);
  window.removeEventListener("deviceorientation", onSensor);
  clearTimeout(liveTimer); live = {aktif: false, arah: null};
  $("dial").style.transform = ""; $("svg").classList.remove("live", "hadap");
  $("liveStatus").hidden = true; $("liveOpts").hidden = true; $("liveMsg").textContent = "";
  $("liveBtn").textContent = "Aktifkan kompas langsung";
}
$("liveBtn").onclick = () => live.aktif ? matikanLive() : aktifkanLive();

/* ---------- Sudut B vs Azimuth pada kompas ---------- */
const titik = (r, t) => [200 + r * Math.sin(rad(t)), 200 - r * Math.cos(rad(t))];   // t: derajat dari Utara searah jarum jam
function busur(r, t0, t1){                                                          // t1 > t0: searah jarum jam
  const [x0, y0] = titik(r, t0), [x1, y1] = titik(r, t1);
  return `M${x0} ${y0} A${r} ${r} 0 ${Math.abs(t1 - t0) > 180 ? 1 : 0} ${t1 > t0 ? 1 : 0} ${x1} ${y1}`;
}
function gambarSudutB(k){
  const {az, B, timur, special} = k;
  // Sudut B diukur dari Utara menuju sisi Ka'bah: ke barat (berlawanan jarum jam) bila tempat di timur Ka'bah
  const ujungB = special ? az : timur ? -B : B;
  $("arcB").setAttribute("d", ujungB === 0 ? "" : busur(100, 0, ujungB));
  const tulis = (id, r, t, teks) => {
    const [x, y] = titik(r, t), el = $(id);
    el.setAttribute("x", x); el.setAttribute("y", y); el.textContent = teks;
  };
  tulis("lblAz", 140, az / 2, az === 0 ? "" : "Az");
  tulis("lblB", 74, ujungB / 2, ujungB === 0 ? "" : "B");

  $("lgAz").textContent = `${az.toFixed(2)}°`;
  $("lgB").textContent = `${B.toFixed(2)}°`;
  $("arcNote").innerHTML = special
    ? `Tempat sebujur atau berseberangan bujur dengan Ka'bah (atau di kutub), sehingga kiblat lurus ke <b>${az === 0 ? "Utara" : "Selatan"}</b> dan Sudut B sama dengan Azimuth.`
    : timur
      ? `Tempat di <b>timur</b> Ka'bah. Sudut B diukur dari Utara <b>berlawanan</b> arah jarum jam ke Barat, sedangkan Azimuth diukur dari Utara <b>searah</b> jarum jam. Keduanya berakhir di arah yang sama, sehingga Azimuth = 360° − ${B.toFixed(2)}° = ${az.toFixed(2)}°.`
      : `Tempat di <b>barat</b> Ka'bah. Sudut B dan Azimuth sama-sama diukur dari Utara <b>searah</b> jarum jam, sehingga Azimuth = B = ${az.toFixed(2)}°.`;
  $("legend").hidden = false; $("arcNote").hidden = false;
}
$("legend").onclick = e => {
  const b = e.target.closest(".lg");
  if (!b) return;
  const on = b.getAttribute("aria-pressed") !== "true";
  b.setAttribute("aria-pressed", String(on));
  $("svg").classList.toggle(b.dataset.k === "az" ? "hide-az" : "hide-b", !on);
};

/* ---------- latihan & cek jawaban ---------- */
const URUTAN_CEK = ["a", "b", "C", "cotB", "B", "az"];
const NAMA_CEK = {a: "a", b: "b", C: "C", cotB: "cot B", B: "Sudut B", az: "Azimuth"};
let soalTerakhir = null;

function setTertutup(on){
  document.body.classList.toggle("tertutup", on);
  $("bukaBtn").hidden = !on;
}

/* Terima desimal (97,5 atau 97.5) maupun DMS (97 30 0 atau 97°30'0"). null = kosong, NaN = tidak terbaca. */
function bacaSudut(s){
  s = s.trim().replace(/,/g, ".");
  if (!s) return null;
  const neg = /^[-−]/.test(s);
  const bagian = s.replace(/^[-−]\s*/, "").split(/[°'′"″\s]+/).filter(Boolean);
  if (!bagian.length || bagian.length > 3) return NaN;
  const [d, m = 0, sd = 0] = bagian.map(Number);
  if ([d, m, sd].some(isNaN)) return NaN;
  const v = d + m / 60 + sd / 3600;
  return neg ? -v : v;
}

function cocok(key, v, kunci){
  if (key === "cotB") return Math.abs(v - kunci) <= Math.max(0.001, Math.abs(kunci) * 5e-4);
  if (key === "az") return Math.abs(normDiff(v - kunci)) <= 0.01;
  return Math.abs(v - kunci) <= 0.01;                               // ±0,01° (±36″) memberi ruang pembulatan manual
}

function petunjuk(key, v, k){
  const dekat = (x, y) => Math.abs(normDiff(x - y)) <= 0.05;
  switch (key) {
    case "a": return k.lat < 0
      ? "a = 90° − φ tempat. Lintang selatan bernilai negatif, jadi a = 90° + |φ| (lebih dari 90°)."
      : "a = 90° − φ tempat.";
    case "b": return `b = 90° − φ Ka'bah = 90° − ${KAABA.lat}°.`;
    case "C": return k.bujurRaw > 180
      ? `Selisih bujur ${k.bujurRaw}° melebihi 180°, jadi ambil sisi terpendek: 360° − ${k.bujurRaw}°.`
      : "C = |λ tempat − λ Ka'bah|. Ingat, bujur barat (BB) bernilai negatif.";
    case "cotB": return "cot B = cot b × sin a ÷ sin C − cos a × cot C. Periksa tanda negatif dan pembulatan nilai trigonometri.";
    case "B":
      if (v < 0 || dekat(v + 180, k.B)) return "cot B bernilai negatif sehingga arccot menghasilkan sudut negatif. Tambahkan 180° pada hasilnya.";
      if (k.timur && dekat(v, k.az)) return "Itu nilai Azimuth. Sudut B diukur dari Utara ke arah Ka'bah dan belum dikonversi.";
      return "B = arccot(cot B), yaitu arctan(1 ÷ cot B).";
    case "az":
      if (k.special) return `${k.rumus}.`;
      if (k.timur && dekat(v, k.B)) return "Tempat ini di timur Ka'bah, jadi Azimuth = 360° − B, bukan B.";
      if (!k.timur && dekat(v, 360 - k.B)) return "Tempat ini di barat Ka'bah, jadi Azimuth = B (tidak dikurangkan dari 360°).";
      return k.timur ? "Tempat di timur Ka'bah: Azimuth = 360° − B." : "Tempat di barat Ka'bah: Azimuth = B.";
  }
  return "";
}

const fmtKunci = (key, v) => key === "cotB" ? String(v) : `${v}° (${fmtDMS(toDMS(v))})`;

function bersihkanTanda(){
  document.querySelectorAll(".cek").forEach(c => c.classList.remove("benar", "salah", "na"));
  $("cekHasil").className = "cekhasil"; $("cekHasil").innerHTML = "";
}

function periksa(){
  if (!lastHasil) {
    hitung();                                   // koordinat sudah diisi tapi belum dihitung: hitung otomatis dulu
    if (!lastHasil) {
      bersihkanTanda();
      $("cekHasil").innerHTML = "<p>Isi koordinat tempat lalu tekan \"Hitung arah kiblat\", atau ambil soal acak dulu, baru jawabanmu bisa diperiksa.</p>";
      $("err").textContent = "";
      tampilkanHasilCek();
      return;
    }
  }
  bersihkanTanda();
  const out = $("cekHasil");
  const {k} = lastHasil;
  const kunci = {a: r5(k.a), b: r5(k.b), C: k.C, cotB: k.special ? null : k.cotB, B: k.B, az: k.az};
  const tertutup = document.body.classList.contains("tertutup");
  let diisi = 0, benar = 0, salahPertama = null;
  const catatan = [], takTerbaca = [];

  for (const key of URUTAN_CEK) {
    const box = document.querySelector(`.cek[data-k="${key}"]`);
    const v = bacaSudut($(`cek-${key}`).value);
    if (v === null) continue;
    if (kunci[key] === null) {
      box.classList.add("na");
      catatan.push("<li><b>cot B</b> tidak dipakai pada kasus khusus (arah lurus ke utara atau selatan).</li>");
      continue;
    }
    if (isNaN(v)) { box.classList.add("salah"); takTerbaca.push(NAMA_CEK[key]); continue; }
    diisi++;
    if (cocok(key, v, kunci[key])) { box.classList.add("benar"); benar++; continue; }
    box.classList.add("salah");
    salahPertama = salahPertama || key;
    catatan.push(`<li><b>${NAMA_CEK[key]}</b>: ${petunjuk(key, v, k)}`
      + (tertutup ? "" : ` Nilai yang benar: <span class="kunci">${fmtKunci(key, kunci[key])}</span>.`) + "</li>");
  }

  let html = "";
  if (!diisi && !takTerbaca.length && !catatan.length) html = "<p>Isi minimal satu kolom jawaban dulu.</p>";
  else {
    if (diisi && benar === diisi && !takTerbaca.length) {
      out.classList.add("ok");
      html += `<p><b>Semua jawaban yang diisi benar (${benar}/${diisi}).</b>`
        + (tertutup ? ' Tekan "Tampilkan pembahasan" untuk melihat langkah lengkapnya.' : "") + "</p>";
    } else if (diisi) {
      html += `<p><b>${benar} dari ${diisi} benar.</b>`
        + (salahPertama ? ` Kesalahan pertama ada di <b>${NAMA_CEK[salahPertama]}</b>; langkah sesudahnya bisa ikut salah karena memakai nilai ini.` : "") + "</p>";
    }
    if (takTerbaca.length) html += `<p>Format tidak terbaca pada: ${takTerbaca.join(", ")}. Tulis desimal (97,5) atau DMS (97 30 0).</p>`;
    if (catatan.length) html += `<ul>${catatan.join("")}</ul>`;
    if (tertutup && benar < diisi) html += '<p>Perbaiki lalu periksa lagi, atau tekan "Tampilkan pembahasan".</p>';
  }
  out.innerHTML = html;
  tampilkanHasilCek();
}

/* Pastikan kotak hasil pemeriksaan terlihat (di HP bisa berada di luar layar) */
function tampilkanHasilCek(){
  const out = $("cekHasil"), r = out.getBoundingClientRect();
  if (r.bottom > window.innerHeight || r.top < 0) out.scrollIntoView({block: "nearest", behavior: "smooth"});
}

$("cekBtn").onclick = periksa;
$("cekReset").onclick = () => { document.querySelectorAll("#cekGrid input").forEach(i => { i.value = ""; }); bersihkanTanda(); };
$("bukaBtn").onclick = () => { setTertutup(false); if ($("cekHasil").textContent) periksa(); };
$("soalBtn").onclick = () => {
  const pilihan = Object.keys(PRACTICE).filter(n => n !== soalTerakhir);
  const nama = soalTerakhir = pilihan[Math.floor(Math.random() * pilihan.length)];
  const [la, ln] = PRACTICE[nama];
  isiKoordinat(la, ln); setMode("DMS");
  document.querySelectorAll("#cekGrid input").forEach(i => { i.value = ""; });
  hitung(true);
  $("soalInfo").innerHTML = `<b>Soal:</b> tentukan arah kiblat untuk <b>${nama}</b> `
    + `(${fmtDMS(toDMS(la), la < 0 ? "LS" : "LU")}, ${fmtDMS(toDMS(ln), ln < 0 ? "BB" : "BT")}). Koordinat sudah terisi di panel input.`;
  $("soalInfo").hidden = false;
  $("cek-a").focus({preventScroll: true});
};

/* ---------- salin hasil dan cetak ---------- */
const lokasiTeks = (lat, lng) => `${fmtDMS(toDMS(lat), lat < 0 ? "LS" : "LU")}, ${fmtDMS(toDMS(lng), lng < 0 ? "BB" : "BT")}`;
$("copyBtn").onclick = async () => {
  if (!lastHasil) return;
  const {k, lat, lng} = lastHasil, btn = $("copyBtn");
  const teks = [
    "Qiblad: arah kiblat",
    `Lokasi: ${lokasiTeks(lat, lng)} (${lat}°, ${lng}°)`,
    `Sudut B: ${k.B.toFixed(4)}° (${fmtDMS(toDMS(k.B))})`,
    `Azimuth kiblat: ${k.az.toFixed(4)}° (${fmtDMS(toDMS(k.az))}) dari Utara sejati, searah jarum jam`,
    `Rumus Azimuth: ${k.rumus}`
  ].join("\n");
  try { await navigator.clipboard.writeText(teks); btn.textContent = "Tersalin ✓"; }
  catch (e) { btn.textContent = "Gagal menyalin"; }
  setTimeout(() => { btn.textContent = "Salin hasil"; }, 2000);
};
$("printBtn").onclick = () => window.print();
window.addEventListener("beforeprint", () => {
  $("stepsDetails").open = true;
  if (!lastHasil) return;
  const {k, lat, lng} = lastHasil;
  const tgl = new Date().toLocaleDateString("id-ID", {day: "numeric", month: "long", year: "numeric"});
  $("printHead").innerHTML = `<b>Qiblad: arah kiblat</b><br>Lokasi ${lokasiTeks(lat, lng)} · Azimuth ${k.az.toFixed(4)}° · Sudut B ${k.B.toFixed(4)}° · dicetak ${tgl}`;
});