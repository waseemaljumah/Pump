// ═══════════════════════════════════════
// utils.js — دوال مساعدة عامة
// ═══════════════════════════════════════

// ─── Toast ───
export function toast(msg, type = 'ok') {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.className = 'toast ' + type;
  el.style.display = 'block';
  clearTimeout(el._t);
  el._t = setTimeout(() => (el.style.display = 'none'), 3200);
}

// ─── التاريخ والوقت الحالي ───
export function nowStamp() {
  return new Date().toLocaleString('ar-SA', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit'
  });
}

export function todayISO() {
  return new Date().toISOString().split('T')[0];
}

// ─── حالة البلاغ ───
export function getStatus(r) {
  if (!r.orderDate)   return { label: 'بدون أمر عمل',       cls: 'b-red',     code: 'no-order' };
  if (r.worked && !r.registered)
                      return { label: 'تم العمل عليها 🔧',  cls: 'b-purple',  code: 'worked'   };
  if (!r.registered)  return { label: 'لم تُسجَّل الأعمال',  cls: 'b-orange',  code: 'noreg'    };
  if (!r.approved)    return { label: 'بانتظار الاعتماد',   cls: 'b-yellow',  code: 'wait'     };
  return               { label: 'مكتمل ✓',                cls: 'b-green',   code: 'done'     };
}

// ─── فلترة حسب الكود ───
export function matchFilter(r, f) {
  if (!f) return true;
  const st = getStatus(r).code;
  if (f === 'done')      return st === 'done';
  if (f === 'no-order')  return st === 'no-order';
  if (f === 'has-order') return !!r.orderDate;
  if (f === 'noreg')     return st === 'noreg';
  if (f === 'worked')    return st === 'worked';
  if (f === 'reg')       return !!r.registered;
  if (f === 'wait')      return st === 'wait';
  return true;
}

// ─── Toggle check-item ───
export function toggleCI(ciId, cbId) {
  const ci = document.getElementById(ciId);
  const cb = document.getElementById(cbId);
  if (!ci || !cb) return;
  ci.classList.toggle('on');
  cb.textContent = ci.classList.contains('on') ? '✓' : '';
}

export function setCI(ciId, cbId, val) {
  const ci = document.getElementById(ciId);
  const cb = document.getElementById(cbId);
  if (!ci || !cb) return;
  if (val) { ci.classList.add('on');    cb.textContent = '✓'; }
  else     { ci.classList.remove('on'); cb.textContent = '';  }
}

export function getCI(ciId) {
  return !!document.getElementById(ciId)?.classList.contains('on');
}

// ─── Render fault / work list ───
export function renderItems(containerId, arr, delFn, editFn, checkFn, rejectFn) {
  const el = document.getElementById(containerId);
  if (!el) return;
  if (!arr.length) {
    el.innerHTML = '<div class="empty-items">لا يوجد عناصر مضافة بعد</div>';
    return;
  }
  
  // التحقق من أن هذا لائحة أعمال (worksList)
  const isWorksList = containerId.includes('worksList') || containerId.includes('works');
  
  el.innerHTML = arr.map((item, i) => {
    const checked = !!item.done;
    const rejected = !!item.rejected;
    const checkCall = checkFn ? `onclick="${checkFn}(${i})"` : '';
    
    return `
    <div class="fault-item ${checked ? 'fault-item-done' : ''} ${rejected ? 'fault-item-rejected' : ''}" id="fi_${containerId}_${i}">
      ${checkFn ? `<div class="item-check ${checked ? 'item-check-on' : rejected ? 'item-check-rejected' : ''}" ${checkCall} title="تحديد كمنجز">${checked ? '✓' : rejected ? '✗' : ''}</div>` : ''}
      <div class="fault-item-body">
        <div class="fault-item-text ${checked ? 'text-striked' : rejected ? 'text-rejected' : ''}" id="fit_${containerId}_${i}">${escHtml(item.text)}</div>
        <div class="fault-item-date">📅 ${item.date}</div>
        ${rejected ? `<div class="fault-item-rejection"><strong>سبب الرفض:</strong> ${escHtml(item.rejectionReason || 'غير محدد')}</div>` : ''}
      </div>
      <div class="fault-item-actions">
        <button class="btn-edit-item" onclick="window._startInlineEdit('${containerId}',${i},'${editFn}')">✏️ تعديل</button>
        ${isWorksList && !rejected && !checked && rejectFn ? `<button class="btn-reject-item" onclick="window._startRejectWork('${containerId}',${i},'${rejectFn}')" title="رفض العمل">❌ رفض</button>` : ''}
        <button class="btn-del-item"  onclick="${delFn}(${i})">🗑️ حذف</button>
      </div>
    </div>`;
  }).join('');
}

// ─── inline edit helpers ───
function escHtml(str) {
  return String(str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function escAttr(str) { return escHtml(str).replace(/'/g,'&#39;'); }

window._startInlineEdit = function(containerId, i, editFn) {
  const textEl  = document.getElementById(`fit_${containerId}_${i}`);
  const wrapper = document.getElementById(`fi_${containerId}_${i}`);
  if (!textEl || !wrapper) return;
  const oldText = textEl.textContent.trim();
  textEl.innerHTML = `
    <textarea class="edit-inline-input" id="ei_${containerId}_${i}">${escHtml(oldText)}</textarea>
    <div class="edit-inline-btns">
      <button class="btn-save-inline"   onclick="window._saveInlineEdit('${containerId}',${i},'${editFn}')">✅ حفظ</button>
      <button class="btn-cancel-inline" onclick="window._cancelInlineEdit('${containerId}',${i},'${escAttr(oldText)}')">إلغاء</button>
    </div>`;
  wrapper.querySelector('.fault-item-actions').style.display = 'none';
  const ta = document.getElementById(`ei_${containerId}_${i}`);
  if (ta) { ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); }
};

window._saveInlineEdit = function(containerId, i, editFn) {
  const ta = document.getElementById(`ei_${containerId}_${i}`);
  if (!ta) return;
  const newText = ta.value.trim();
  if (!newText) { alert('لا يمكن الحفظ بنص فارغ'); return; }
  const fn = editFn.replace('window.APP.', '');
  if (window.APP && typeof window.APP[fn] === 'function') window.APP[fn](i, newText);
};

window._cancelInlineEdit = function(containerId, i, oldText) {
  const textEl  = document.getElementById(`fit_${containerId}_${i}`);
  const wrapper = document.getElementById(`fi_${containerId}_${i}`);
  if (textEl)  textEl.innerHTML = oldText;
  const actEl = wrapper?.querySelector('.fault-item-actions');
  if (actEl) actEl.style.display = '';
};

// ─── Reject work inline ───
window._startRejectWork = function(containerId, i, rejectFn) {
  const wrapper = document.getElementById(`fi_${containerId}_${i}`);
  const textEl  = document.getElementById(`fit_${containerId}_${i}`);
  if (!wrapper || !textEl) return;
  
  const currentText = textEl.textContent.trim();
  
  textEl.innerHTML = `
    <div style="margin-top:8px;">
      <label style="display:block;margin-bottom:5px;font-weight:600;color:#e65100;">سبب رفض العمل:</label>
      <textarea class="edit-inline-input" id="rej_${containerId}_${i}" placeholder="اكتب سبب رفض هذا العمل..." rows="3"></textarea>
      <div class="edit-inline-btns">
        <button class="btn-reject-confirm" onclick="window._saveRejectWork('${containerId}',${i},'${rejectFn}')">❌ تأكيد الرفض</button>
        <button class="btn-cancel-inline" onclick="window._cancelRejectWork('${containerId}',${i},'${escAttr(currentText)}')">إلغاء</button>
      </div>
    </div>`;
  
  wrapper.querySelector('.fault-item-actions').style.display = 'none';
  const ta = document.getElementById(`rej_${containerId}_${i}`);
  if (ta) ta.focus();
};

window._saveRejectWork = function(containerId, i, rejectFn) {
  const ta = document.getElementById(`rej_${containerId}_${i}`);
  if (!ta) return;
  const reason = ta.value.trim();
  if (!reason) {
    alert('يجب كتابة سبب الرفض');
    return;
  }
  
  const fn = rejectFn.replace('window.APP.', '');
  if (window.APP && typeof window.APP[fn] === 'function') {
    window.APP[fn](i, reason);
  }
};

window._cancelRejectWork = function(containerId, i, oldText) {
  const textEl  = document.getElementById(`fit_${containerId}_${i}`);
  const wrapper = document.getElementById(`fi_${containerId}_${i}`);
  if (textEl)  textEl.innerHTML = oldText;
  const actEl = wrapper?.querySelector('.fault-item-actions');
  if (actEl) actEl.style.display = '';
};
