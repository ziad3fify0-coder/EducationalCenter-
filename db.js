/**
 * ربط صفحة متابعة ولي الأمر بقاعدة البيانات.
 * الرابط بيحمل الكود السري للطالب: index.html?t=الكود  (أو index.html#الكود)
 * الصفحة بتقرأ بيانات الطالب ده بس (قراءة فقط) وبتحفظ آخر نسخة على الموبايل للفتح من غير نت.
 */
(function () {
  var DB_URL = "https://pjspuobykqdmhlzvfgyu.supabase.co";
  var DB_KEY = "sb_publishable_9dZXdStm-n27T64rLfQCWA_qZkMe_r0";
  var TOKEN_RE = /^[A-Za-z0-9_-]{16,64}$/;
  var MONTHS = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];

  // إخفاء البيانات الوهمية لحد ما البيانات الحقيقية توصل
  var hide = document.createElement("style");
  hide.textContent = ".app-shell{visibility:hidden}#dbStatus{position:fixed;inset:0;display:grid;place-items:center;padding:24px;text-align:center;font:600 16px 'Cairo',sans-serif;color:#6b7280;background:#f6f5fb}";
  document.head.appendChild(hide);
  var status = document.createElement("div");
  status.id = "dbStatus";
  status.textContent = "جاري تحميل بيانات الطالب…";
  document.body.appendChild(status);

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function esc(v) {
    return String(v == null ? "" : v).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function setText(el, v) { if (el) el.textContent = v; }
  function num(n) { return Math.round(Number(n) * 10) / 10; }
  function pct(n) { return n == null ? "—" : num(n).toFixed(1) + "%"; }
  function money(n) { return num(n) + " ج"; }
  function cairoToday() {
    return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Cairo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  }
  function ymd(d) { return String(d || "").slice(0, 10); }
  function dmy(d) { var p = ymd(d).split("-"); return p.length === 3 ? p[2] + "/" + p[1] + "/" + p[0] : "—"; }
  function longDate(d) { var p = ymd(d).split("-"); return p.length === 3 ? p[2] + " " + MONTHS[Number(p[1]) - 1] + " " + p[0] : ""; }

  function grade(p) {
    if (p >= 90) return { label: "ممتاز", cls: "excellent" };
    if (p >= 80) return { label: "جيد جداً", cls: "good" };
    if (p >= 65) return { label: "جيد", cls: "average" };
    if (p >= 50) return { label: "مقبول", cls: "average" };
    return { label: "ضعيف", cls: "absent-label" };
  }

  function readToken() {
    var q = new URLSearchParams(location.search);
    var t = q.get("t") || q.get("token") || q.get("id") || decodeURIComponent(location.hash.replace(/^#\/?/, ""));
    if (!t) {
      var parts = location.pathname.split("/").filter(Boolean);
      t = parts[parts.length - 1] || "";
    }
    t = (t || "").trim();
    return TOKEN_RE.test(t) ? t : null;
  }

  function rpc(name, args) {
    return fetch(DB_URL + "/rest/v1/rpc/" + name, {
      method: "POST",
      headers: { apikey: DB_KEY, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(args),
      cache: "no-store",
    }).then(function (r) {
      if (!r.ok) throw new Error("db " + r.status);
      return r.text();
    }).then(function (txt) { return txt ? JSON.parse(txt) : null; });
  }

  // نفس ترتيب صفحة ولي الأمر الأساسية: بيانات برنامج الويندوز الأول، بعدين النسخة الأونلاين
  function fetchCard(token) {
    return rpc("get_parent_card", { _token: token }).then(function (synced) {
      if (synced && synced.data) return { card: synced.data, updated_at: synced.updated_at || null };
      return rpc("get_student_card", { _card_id: token }).then(function (card) {
        return card ? { card: card, updated_at: new Date().toISOString() } : null;
      });
    });
  }

  function saveKey(token) { return "parent-card:" + token; }

  function load(token) {
    return fetchCard(token).then(function (fresh) {
      try {
        if (fresh) localStorage.setItem(saveKey(token), JSON.stringify(fresh));
        else localStorage.removeItem(saveKey(token));
      } catch (e) { /* مساحة الموبايل ممتلئة */ }
      return fresh;
    }, function (err) {
      try {
        var saved = JSON.parse(localStorage.getItem(saveKey(token)) || "null");
        if (saved && saved.card) { saved.offline = true; return saved; }
      } catch (e) { /* ignore */ }
      throw err;
    });
  }

  /* ============ حسابات ============ */
  function compute(c) {
    var exams = (c.exams || []).map(function (e) {
      var max = Number(e.max_score);
      return {
        title: e.title || e.subject || "امتحان",
        date: ymd(e.exam_date),
        score: Number(e.score),
        max: max,
        percent: max > 0 ? (Number(e.score) / max) * 100 : null,
      };
    }).sort(function (a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : 0; });
    var percents = exams.map(function (e) { return e.percent; }).filter(function (p) { return p != null; });
    var present = Number(c.present_days) || 0;
    var absent = Number(c.absent_days) || 0;
    var attTotal = present + absent;
    var today = cairoToday();
    var fee = Math.max(0, Number(c.monthly_fee) || 0);
    var enrolled = ymd(c.enrolled_on) || today;
    var ey = Number(enrolled.slice(0, 4)), em = Number(enrolled.slice(5, 7));
    var ty = Number(today.slice(0, 4)), tm = Number(today.slice(5, 7));
    var monthsDue = Math.max(1, (ty - ey) * 12 + (tm - em) + 1);
    var paid = Math.max(0, Number(c.paid) || 0);
    var paidMonths = fee > 0 ? Math.floor(paid / fee + 1e-9) : monthsDue;
    return {
      exams: exams,
      percents: percents,
      minP: percents.length ? Math.min.apply(null, percents) : null,
      maxP: percents.length ? Math.max.apply(null, percents) : null,
      avgP: percents.length ? percents.reduce(function (a, b) { return a + b; }, 0) / percents.length : null,
      present: present,
      absent: absent,
      attP: attTotal ? (present / attTotal) * 100 : null,
      today: today,
      fee: fee,
      enrolled: enrolled,
      ey: ey, em: em,
      monthsDue: monthsDue,
      paid: paid,
      paidMonths: paidMonths,
      remaining: Math.max(0, fee * monthsDue - paid),
      absences: (c.absences || []).map(function (a) { return { date: ymd(a.date), note: a.note }; }),
      notes: c.notes || [],
    };
  }

  /* ============ تعبئة الصفحة ============ */
  function render(c, meta) {
    var d = compute(c);
    var name = c.full_name || "";
    var first = name.split(/\s+/)[0] || name;
    var letter = name.trim().charAt(0) || "؟";
    var stage = c.stage_name || "—";
    var group = c.group_name || "—";
    var code = c.card_id || "—";

    document.title = name + " | لوحة الطالب";
    setText($("#topStudentName"), name);
    setText($(".student-chip small"), stage);
    setText($(".student-chip .avatar"), letter);
    setText($(".side-profile .profile-avatar"), letter);
    setText($(".side-profile b"), name);
    setText($(".side-profile span"), "رقم الطالب: " + code);
    setText($(".welcome h1 span"), first);
    if (meta && meta.updated_at) {
      setText($("#todayDate"), (meta.offline ? "بدون نت · " : "") + "آخر تحديث " + longDate(new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Cairo" }).format(new Date(meta.updated_at))));
    }

    // الرئيسية
    var ov = $$("#overview .stats-grid .stat-card");
    setText($("strong", ov[0]), String(d.exams.length));
    setText($("small", ov[0]), "آخر " + d.exams.length + " امتحانات مسجلة");
    setText($("strong", ov[1]), pct(d.minP));
    setText($("strong", ov[2]), pct(d.maxP));
    setText($("strong", ov[3]), pct(d.attP));
    setText($("small", ov[3]), d.present + " حضور · " + d.absent + " غياب");
    var dots = ["", " blue-dot", " gold-dot"];
    $("#overview .result-list").innerHTML = d.exams.length
      ? d.exams.slice(0, 3).map(function (e, i) {
          var g = e.percent == null ? { label: "—", cls: "" } : grade(e.percent);
          return '<div class="result-row"><span class="subject-dot' + dots[i] + '"></span><b>' + esc(e.title) + "</b><span>" + num(e.score) + " / " + num(e.max) + '</span><em class="' + g.cls + '">' + g.label + "</em></div>";
        }).join("")
      : '<div class="empty-state">لا توجد امتحانات مسجلة بعد</div>';
    var attNum = d.attP == null ? 0 : num(d.attP);
    $(".donut").style.background = "conic-gradient(var(--green) 0 " + attNum + "%,var(--orange) " + attNum + "% 100%)";
    setText($(".donut b"), pct(d.attP));
    var leg = $$(".legend span b");
    setText(leg[0], String(d.present));
    setText(leg[1], String(d.absent));

    // الملف الشخصي
    setText($("#profile .large-avatar"), letter);
    setText($("#profile .profile-panel h2"), name);
    setText($("#profile .profile-panel p.muted"), c.stage_name ? "طالب بـ" + c.stage_name : "");
    var det = $$("#profile .detail");
    setText($("b", det[0]), code);
    det[1].style.display = "none"; // أرقام الموبايل مش بتتبعت لصفحة ولي الأمر
    det[2].style.display = "none";
    setText($("b", det[3]), group);
    setText($("b", det[4]), dmy(d.enrolled));
    setText($("b", det[5]), stage);

    // المصروفات
    var ex = $$("#expenses .stat-card strong");
    setText(ex[0], money(d.fee));
    setText(ex[1], d.paidMonths >= d.monthsDue ? "تم الدفع" : "لم يتم الدفع");
    setText(ex[2], String(Math.min(d.paidMonths, 999)));
    var last = d.monthsDue + 1; // الشهر الجاي والجاي بعده
    var first0 = Math.max(0, last - 5);
    var cells = [];
    for (var i = first0; i <= last; i++) {
      var m = (d.em - 1 + i) % 12;
      var cls, label;
      if (i < d.paidMonths) { cls = "paid"; label = "✓ مدفوع"; }
      else if (i < d.monthsDue) { cls = "unpaid"; label = "× لم يتم الدفع"; }
      else { cls = "future"; label = "◷ قادم"; }
      cells.push('<div class="month ' + cls + '"><b>' + MONTHS[m] + "</b><span>" + label + "</span></div>");
    }
    $("#expenses .months").innerHTML = cells.join("");
    var upd = meta && meta.updated_at ? new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Cairo" }).format(new Date(meta.updated_at)) : d.today;
    $("#expenses tbody").innerHTML =
      "<tr><td>" + upd + '</td><td>إجمالي المدفوع</td><td class="amount">' + money(d.paid) + "</td></tr>" +
      "<tr><td>" + upd + '</td><td>المتبقي</td><td class="amount">' + money(d.remaining) + "</td></tr>";

    // الامتحانات
    setText($("#exams .status-pill"), d.exams.length + " امتحانات مكتملة");
    var es = $$("#exams .stat-card strong");
    setText(es[0], String(d.exams.length));
    setText(es[1], pct(d.minP));
    setText(es[2], pct(d.maxP));
    setText(es[3], pct(d.avgP));
    $("#exams tbody").innerHTML = d.exams.length
      ? d.exams.map(function (e) {
          var g = e.percent == null ? { label: "—", cls: "" } : grade(e.percent);
          return "<tr><td>" + esc(e.date) + "</td><td>" + esc(e.title) + '</td><td class="amount">' + num(e.score) + " / " + num(e.max) + '</td><td><em class="' + g.cls + '">' + g.label + "</em></td></tr>";
        }).join("")
      : '<tr><td colspan="4">لا توجد امتحانات مسجلة بعد</td></tr>';

    // الحضور والغياب
    var at = $$("#attendance .stat-card strong");
    setText(at[0], String(d.present));
    setText(at[1], String(d.absent));
    setText(at[2], pct(d.attP));
    setText($("#attendance .panel h3"), "آخر أيام الغياب");
    $("#attendance .activity-list").innerHTML = d.absences.length
      ? d.absences.map(function (a) {
          return '<div class="activity"><span class="activity-mark absent"></span><div><b>' + esc(group) + "</b><small>" + esc(longDate(a.date)) + (a.note ? " · " + esc(a.note) : "") + '</small></div><em class="absent-label">غائب</em></div>';
        }).join("")
      : '<div class="empty-state">لا يوجد غياب مسجل</div>';

    // التحليل العام
    var byMonth = {};
    d.exams.forEach(function (e) {
      if (e.percent == null) return;
      var k = e.date.slice(0, 7);
      (byMonth[k] = byMonth[k] || []).push(e.percent);
    });
    var absByMonth = {};
    d.absences.forEach(function (a) { var k = a.date.slice(0, 7); absByMonth[k] = (absByMonth[k] || 0) + 1; });
    var keys = [];
    for (var j = 4; j >= 0; j--) {
      var dt = new Date(Date.UTC(Number(d.today.slice(0, 4)), Number(d.today.slice(5, 7)) - 1 - j, 1));
      keys.push(dt.toISOString().slice(0, 7));
    }
    var labels = keys.map(function (k) { return MONTHS[Number(k.slice(5, 7)) - 1] + " " + k.slice(0, 4); });
    var monthly = keys.map(function (k) { var a = byMonth[k]; return a ? num(a.reduce(function (x, y) { return x + y; }, 0) / a.length) : 0; });
    var absences = keys.map(function (k) { return absByMonth[k] || 0; });
    var attPanel = $("#attendanceChart").closest(".panel");
    setText($("h3", attPanel), "الغياب الشهري");
    setText($(".muted", attPanel), "عدد أيام الغياب");

    var counts = {};
    d.percents.forEach(function (p) { var g = grade(p).label; counts[g] = (counts[g] || 0) + 1; });
    var gLabels = ["ممتاز", "جيد جداً", "جيد", "مقبول", "ضعيف"].filter(function (g) { return counts[g]; });
    var gColors = { "ممتاز": "#ff854b", "جيد جداً": "#4e78dc", "جيد": "#52bea5", "مقبول": "#f4b91d", "ضعيف": "#f04450" };

    window.drawGrades = function () {
      var canvas = document.getElementById("gradesChart");
      if (!canvas || gradesChart) return;
      gradesChart = new Chart(canvas, { type: "doughnut", data: { labels: gLabels, datasets: [{ data: gLabels.map(function (g) { return counts[g]; }), backgroundColor: gLabels.map(function (g) { return gColors[g]; }), borderColor: "#fff", borderWidth: 4 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "top", labels: { usePointStyle: true, font: { family: "Cairo" } } } } } });
    };
    window.drawAnalysis = function () {
      if (monthlyChart) return;
      monthlyChart = new Chart(document.getElementById("monthlyChart"), { type: "line", data: { labels: labels, datasets: [{ label: "النسبة المئوية", data: monthly, borderColor: "#52bea5", backgroundColor: "#52bea522", fill: true, tension: 0.4, pointRadius: 5 }] }, options: chartDefaults });
      var absOpts = JSON.parse(JSON.stringify(chartDefaults));
      delete absOpts.scales.y.max;
      absOpts.scales.y.ticks.precision = 0;
      attendanceChart = new Chart(document.getElementById("attendanceChart"), { type: "bar", data: { labels: labels, datasets: [{ label: "أيام الغياب", data: absences, backgroundColor: "#6250b8", borderRadius: 9 }] }, options: absOpts });
    };

    // التقرير اليومي
    var todayNotes = d.notes.filter(function (n) {
      return n.created_at && new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Cairo" }).format(new Date(n.created_at)) === d.today;
    });
    var notesBox = $("#daily .empty-state");
    if (todayNotes.length) {
      var list = document.createElement("div");
      list.className = "activity-list";
      list.innerHTML = todayNotes.map(function (n) {
        return '<div class="activity"><div><b>' + esc(n.body) + "</b><small>" + esc(n.author || "المركز") + "</small></div></div>";
      }).join("");
      notesBox.replaceWith(list);
    }
    var absentToday = d.absences.some(function (a) { return a.date === d.today; });
    var boxes = $$("#daily .daily-box");
    setText($("strong", boxes[0]), absentToday ? "×" : "✓");
    setText($("span", boxes[0]), absentToday ? "تم تسجيل غياب اليوم" : "لا يوجد غياب مسجل اليوم");
    setText($("strong", boxes[1]), pct(d.attP));
    setText($("strong", boxes[2]), pct(d.avgP));
  }

  function fail(msg) {
    status.textContent = msg;
  }

  var token = readToken();
  if (!token) {
    fail("الرابط ناقص — افتح الصفحة من الرابط أو الـ QR اللي استلمته من المركز.");
    return;
  }
  load(token).then(function (res) {
    if (!res) { fail("الرابط ده مش مربوط بطالب حالياً — تواصل مع المركز."); return; }
    render(res.card, res);
    status.remove();
    hide.remove();
  }).catch(function () {
    fail("تعذّر تحميل بيانات الطالب، تأكد من النت وحاول مرة تانية.");
  });
})();
