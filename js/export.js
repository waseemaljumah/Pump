// ═══════════════════════════════════════
// export.js — تصدير Excel
// ═══════════════════════════════════════

import { state } from './state.js';
import { getStatus } from './utils.js';

// ─── فلترة بيانات التصدير ───
function getExportData() {
  const city = document.getElementById('ex_city')?.value || '';
  const from = document.getElementById('ex_from')?.value || '';
  const to   = document.getElementById('ex_to')?.value   || '';
  const st   = document.getElementById('ex_st')?.value   || '';

  return state.reports.filter(r => {
    if (city && r.city !== city)          return false;
    if (from && r.date < from)            return false;
    if (to   && r.date > to)              return false;
    const code = getStatus(r).code;
    if (st === 'done'       && code !== 'done') return false;
    if (st === 'incomplete' && code === 'done') return false;
    return true;
  });
}

// ─── معاينة ───
export function previewExport() {
  const data = getExportData();
  document.getElementById('prevCount').textContent = data.length;
  document.getElementById('prevCard').style.display = 'block';

  document.getElementById('prevBody').innerHTML = data.map(r => `
    <tr>
      <td>${r.num || '—'}</td>
      <td>${r.pumpNum || '—'}</td>
      <td>${r.city}</td>
      <td>${r.date}</td>
      <td>${(r.faults || []).map(f => f.text).join(' | ')}</td>
      <td>${r.orderDate || '—'}</td>
      <td>${(r.works || []).map(w => w.text).join(' | ')}</td>
      <td><span class="badge ${r.registered ? 'b-green':'b-red'}">${r.registered?'نعم':'لا'}</span></td>
      <td><span class="badge ${r.approved   ? 'b-green':'b-red'}">${r.approved  ?'نعم':'لا'}</span></td>
      <td>${r.notes || '—'}</td>
    </tr>`).join('');
}

// ─── تصدير ───
export function doExport() {
  const data = getExportData();
  if (!data.length) {
    alert('لا توجد بيانات للتصدير');
    return;
  }

  const headers = [
    'رقم البلاغ','رقم المضخة','البلدية','تاريخ البلاغ',
    'الأعطال (مع التواريخ)','تاريخ أمر العمل',
    'الأعمال التي تمت (مع التواريخ)',
    'تم التسجيل','تم الاعتماد','ملاحظات','الحالة'
  ];

  const rows = [headers, ...data.map(r => [
    r.num || '',
    r.pumpNum || '',
    r.city,
    r.date,
    (r.faults || []).map(f => `${f.text}  [${f.date}]`).join('\n'),
    r.orderDate || '',
    (r.works  || []).map(w => `${w.text}  [${w.date}]`).join('\n'),
    r.registered ? 'نعم' : 'لا',
    r.approved   ? 'نعم' : 'لا',
    r.notes || '',
    getStatus(r).label
  ])];

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [12,14,12,13,50,15,50,14,12,35,16].map(w => ({ wch: w }));

  XLSX.utils.book_append_sheet(wb, ws, 'بلاغات المضخات');

  const today = new Date().toISOString().split('T')[0];
  XLSX.writeFile(wb, `بلاغات_المضخات_${today}.xlsx`);
}
