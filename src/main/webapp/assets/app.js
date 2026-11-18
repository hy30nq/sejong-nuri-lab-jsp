const $ = (selector, root = document) => root.querySelector(selector)
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)]

async function api(path, options = {}) {
  const init = { ...options, headers: { ...(options.body && !(options.body instanceof FormData) ? { 'Content-Type': 'application/json; charset=UTF-8' } : {}), ...(options.headers || {}) } }
  const response = await fetch(path, init)
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: '요청을 처리하지 못했습니다.' }))
    throw new Error(error.message || '요청을 처리하지 못했습니다.')
  }
  if (response.status === 204) return null
  const type = response.headers.get('content-type') || ''
  return type.includes('application/json') ? response.json() : response.text()
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character])
}

function showMessage(message, success = false, target = $('.global-message')) {
  if (!target) return
  target.textContent = message
  target.classList.toggle('success', success)
  target.hidden = false
}

function statusClass(status) {
  if (status === '처리 완료' || status === '승인 완료') return 'status done'
  if (status === '승인 대기' || status === '담당자 검토') return 'status waiting'
  return 'status'
}

$('.mobile-menu-button')?.addEventListener('click', event => {
  const menu = $('.mobile-nav')
  menu.hidden = !menu.hidden
  event.currentTarget.setAttribute('aria-expanded', String(!menu.hidden))
})

$('[data-logout]')?.addEventListener('click', async () => {
  await api('/api/citizens/logout', { method: 'POST' })
  location.href = '/'
})

if (document.body.dataset.page === 'login') {
  $('#login-form')?.addEventListener('submit', async event => {
    event.preventDefault()
    const message = $('.form-message', event.currentTarget)
    message.hidden = true
    const form = new FormData(event.currentTarget)
    try {
      const result = await api('/api/citizens/login', { method: 'POST', body: JSON.stringify({ username: form.get('username'), password: form.get('password') }) })
      const allowed = new Set(['/apply', '/account', '/admin', '/complaints', '/board', '/documents', '/attachments', '/certificates', '/settings', '/identity', '/status'])
      const requested = new URLSearchParams(location.search).get('next') || ''
      const base = requested.split(/[?#]/)[0]
      location.href = allowed.has(base) && !requested.includes('\\') ? requested : (result.user.role === 'staff' ? '/admin' : '/account')
    } catch (error) { showMessage(error.message, false, message) }
  })
  $('#account-check-form')?.addEventListener('submit', async event => {
    event.preventDefault()
    const username = String(new FormData(event.currentTarget).get('accountUsername') || '')
    const result = $('.account-check-result')
    result.textContent = '확인 중...'
    try {
      const data = await api('/api/public/account-check?username=' + encodeURIComponent(username))
      result.textContent = `'${username}' 아이디는 등록되어 ${data.registered ? '있습니다.' : '있지 않습니다.'}`
    } catch (error) { result.textContent = error.message }
  })
}

if (document.body.dataset.page === 'services') {
  const input = $('#service-search')
  const initial = new URLSearchParams(location.search).get('q') || ''
  input.value = initial
  const filter = () => {
    const query = input.value.trim().toLocaleLowerCase()
    $$('.service-directory>section').forEach(section => { section.hidden = Boolean(query) && !section.textContent.toLocaleLowerCase().includes(query) })
  }
  $('.directory-search')?.addEventListener('submit', event => { event.preventDefault(); filter(); history.replaceState(null, '', input.value.trim() ? '?q=' + encodeURIComponent(input.value.trim()) : '/services') })
  filter()
}

$('#application-form')?.addEventListener('submit', async event => {
  event.preventDefault()
  const formElement = event.currentTarget
  const form = new FormData(formElement)
  try {
    const result = await api('/api/applications', { method: 'POST', body: JSON.stringify({ category: form.get('category'), title: form.get('title'), detail: form.get('detail') }) })
    formElement.parentElement.hidden = true
    const success = $('#application-success')
    $('strong', success).textContent = result.displayId
    success.hidden = false
  } catch (error) { showMessage(error.message, false, $('.form-message', formElement)) }
})

if (document.body.dataset.page === 'civic') {
  const section = document.body.dataset.section
  const resultBox = message => {
    let box = $('.result-box')
    if (!box) { box = document.createElement('pre'); box.className = 'result-box'; $('.workspace-content').append(box) }
    box.textContent = message
  }

  if (section === 'complaints') {
    const rows = $('#application-rows')
    const detail = $('#application-detail')
    const renderApplications = items => {
      rows.innerHTML = items.length ? items.map(item => `<div class="table-row"><span>${escapeHtml(item.displayId)}</span><strong>${escapeHtml(item.title)}</strong><span class="${statusClass(item.status)}">${escapeHtml(item.status)}</span><button class="secondary-button" data-receipt="${escapeHtml(item.displayId)}">상세보기</button></div>`).join('') : '<p>등록된 민원이 없습니다.</p>'
      $$('[data-receipt]', rows).forEach(button => button.addEventListener('click', () => loadDetail(button.dataset.receipt)))
    }
    const loadDetail = async receipt => {
      try {
        const { application: item } = await api('/api/applications?receiptNo=' + encodeURIComponent(receipt))
        detail.innerHTML = `<div class="detail-heading"><h2>${escapeHtml(item.title)}</h2><p>신청번호 ${escapeHtml(item.display_id)} · 처리상태 ${escapeHtml(item.status)}</p></div><div class="detail-body">${escapeHtml(item.detail)}</div><dl class="detail-grid"><div><dt>신청인</dt><dd>${escapeHtml(item.applicant_name)}</dd></div><div><dt>연락처</dt><dd>${escapeHtml(item.applicant_phone)}</dd></div><div><dt>이메일</dt><dd>${escapeHtml(item.applicant_email)}</dd></div><div><dt>주소</dt><dd>${escapeHtml(item.applicant_address)}</dd></div></dl><small>계정 ${escapeHtml(item.owner_username)}</small>`
        detail.hidden = false
        history.replaceState(null, '', '/complaints?receiptNo=' + encodeURIComponent(receipt))
      } catch (error) { showMessage(error.message) }
    }
    api('/api/applications').then(data => renderApplications(data.applications)).catch(error => showMessage(error.message))
    $('#receipt-form')?.addEventListener('submit', event => { event.preventDefault(); loadDetail(String(new FormData(event.currentTarget).get('receiptNo') || '').trim()) })
    const selected = new URLSearchParams(location.search).get('receiptNo')
    if (selected) loadDetail(selected)
  }

  if (section === 'board') {
    const list = $('#board-posts')
    const loadPosts = async () => {
      const data = await api('/api/board/posts')
      list.innerHTML = data.posts.length ? data.posts.map(post => `<article><header><strong>${escapeHtml(post.author)}</strong><time>${escapeHtml(post.created_at)}</time></header><div class="post-body">${post.content}</div></article>`).join('') : '<p>첫 의견을 남겨주세요.</p>'
    }
    loadPosts().catch(error => showMessage(error.message))
    $('#board-form')?.addEventListener('submit', async event => {
      event.preventDefault(); const formElement = event.currentTarget; const form = new FormData(formElement)
      try { await api('/api/board/posts', { method: 'POST', body: JSON.stringify({ content: form.get('content') }) }); formElement.reset(); await loadPosts(); showMessage('의견이 등록되었습니다.', true) }
      catch (error) { showMessage(error.message) }
    })
  }

  if (section === 'documents') {
    $('[data-document-download]')?.addEventListener('click', async () => { try { resultBox(await api('/api/documents/download?file=guide.txt')) } catch (error) { resultBox(error.message) } })
    $('#preview-form')?.addEventListener('submit', async event => { event.preventDefault(); try { const data = await api('/api/documents/preview?url=' + encodeURIComponent(new FormData(event.currentTarget).get('url'))); resultBox(data.body) } catch (error) { resultBox(error.message) } })
  }

  if (section === 'attachments') {
    $('#upload-form')?.addEventListener('submit', async event => {
      event.preventDefault()
      try { const data = await api('/api/attachments', { method: 'POST', body: new FormData(event.currentTarget) }); const link = $('.upload-link'); link.href = data.publicUrl; link.hidden = false; showMessage(`${data.originalName} 파일이 등록되었습니다.`, true) }
      catch (error) { showMessage(error.message) }
    })
  }

  if (section === 'certificates') {
    api('/api/certificates').then(data => {
      $('#certificate-list').innerHTML = data.certificates.map(item => `<article class="certificate-item"><header><span>문서번호 ${escapeHtml(item.id)}</span><span class="${statusClass(item.status)}">${escapeHtml(item.status)}</span></header><h3>${escapeHtml(item.title)}</h3>${item.status === '승인 완료' ? `<a class="primary-button" href="/api/certificates/${encodeURIComponent(item.id)}/download" download>전자증명서 발급</a>` : '<button class="secondary-button" disabled>승인 후 발급 가능</button>'}</article>`).join('')
    }).catch(error => showMessage(error.message))
  }

  if (section === 'settings') {
    let enabled = true
    const button = $('#email-setting')
    const paint = () => { button.textContent = enabled ? '사용 중' : '사용 안 함' }
    api('/api/citizens/preferences').then(data => { enabled = data.emailEnabled; paint() }).catch(error => showMessage(error.message))
    button?.addEventListener('click', async () => { try { const data = await api('/api/citizens/preferences/email?enabled=' + !enabled); enabled = data.emailEnabled; paint(); showMessage(`이메일 알림이 ${enabled ? '켜졌습니다.' : '꺼졌습니다.'}`, true) } catch (error) { showMessage(error.message) } })
  }

  if (section === 'identity') {
    const paint = data => { const state = $('#identity-state'); $('strong', state).textContent = data.verified ? '본인 확인 완료' : '본인 확인 전'; $('small', state).textContent = data.verified ? `확인 일시 ${data.verifiedAt || '방금'}` : '인증번호 확인 후 일부 서비스를 이용할 수 있습니다.' }
    api('/api/citizens/identity/status').then(paint).catch(error => showMessage(error.message))
    $('#identity-form')?.addEventListener('submit', async event => { event.preventDefault(); try { const data = await api('/api/citizens/identity/complete', { method: 'POST', body: JSON.stringify({ verificationStep: 'verify', code: new FormData(event.currentTarget).get('code') }) }); paint(data); showMessage(data.message, true) } catch (error) { showMessage(error.message) } })
  }

  if (section === 'status' && $('#health-card')) {
    const refresh = async () => {
      const card = $('#health-card'), label = $('strong', card)
      label.textContent = '상태 확인 중'
      try { const data = await api('/api/service/status/check?target=portal.internal'); label.textContent = data.serviceAvailable ? '정상 운영 중' : '서비스 점검 중'; card.classList.toggle('is-down', !data.serviceAvailable); $('#health-time').textContent = '마지막 확인 ' + new Date().toLocaleString('ko-KR') + ' · 30초마다 자동 갱신' }
      catch { label.textContent = '상태 확인 지연'; card.classList.add('is-down') }
    }
    $('#health-refresh').addEventListener('click', refresh); refresh(); setInterval(refresh, 30000)
  }
}

if (document.body.dataset.page === 'admin') {
  let overview
  const selectTab = name => {
    $$('[data-admin-tab]').forEach(button => button.classList.toggle('active', button.dataset.adminTab === name))
    $$('[data-admin-panel]').forEach(panel => { panel.hidden = panel.dataset.adminPanel !== name })
  }
  $$('[data-admin-tab]').forEach(button => button.addEventListener('click', () => selectTab(button.dataset.adminTab)))
  $$('[data-show-tab]').forEach(button => button.addEventListener('click', () => selectTab(button.dataset.showTab)))

  const renderApplications = (root, items) => {
    root.innerHTML = `<div class="table-head"><span>접수번호</span><span>민원 내용</span><span>신청자</span><span>처리 상태</span></div>` + items.map(item => `<div class="table-row"><span>${escapeHtml(item.displayId)}</span><strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(item.ownerName)}</span><select data-status-id="${item.id}"><option ${item.status === '접수 완료' ? 'selected' : ''}>접수 완료</option><option ${item.status === '처리 중' ? 'selected' : ''}>처리 중</option><option ${item.status === '처리 완료' ? 'selected' : ''}>처리 완료</option></select></div>`).join('')
    $$('[data-status-id]', root).forEach(select => select.addEventListener('change', async () => { try { await api('/api/admin/applications/' + select.dataset.statusId + '/status', { method: 'PATCH', body: JSON.stringify({ status: select.value }) }); showMessage('민원 처리 상태를 저장했습니다.', true); await loadOverview() } catch (error) { showMessage(error.message) } }))
  }
  const render = () => {
    Object.entries(overview.counts).forEach(([key, value]) => $$(`[data-count="${key}"]`).forEach(node => { node.textContent = Number(value).toLocaleString('ko-KR') }))
    $$('.admin-applications').forEach(root => renderApplications(root, overview.applications))
    $('.admin-recent-notices').innerHTML = overview.notices.slice(0, 5).map(item => `<div><span class="kind">${item.kind === 'important' ? '중요' : '일반'}</span><strong>${escapeHtml(item.title)}</strong><time>${escapeHtml(item.publishedAt)}</time></div>`).join('')
    $('.admin-notices').innerHTML = overview.notices.map(item => `<div><span class="kind">${item.kind === 'important' ? '중요' : '일반'}</span><strong>${escapeHtml(item.title)}</strong><time>${escapeHtml(item.publishedAt)}</time></div>`).join('')
    $('.admin-posts').innerHTML = overview.posts.length ? overview.posts.map(item => `<article><header><strong>${escapeHtml(item.author)}</strong><span><time>${escapeHtml(item.createdAt)}</time> <button data-delete-post="${item.id}">삭제</button></span></header><div class="post-body">${escapeHtml(item.content)}</div></article>`).join('') : '<p>등록된 의견이 없습니다.</p>'
    $$('[data-delete-post]').forEach(button => button.addEventListener('click', async () => { if (!confirm('이 의견을 삭제하시겠습니까?')) return; try { await api('/api/admin/board/posts/' + button.dataset.deletePost, { method: 'DELETE' }); showMessage('게시글을 삭제했습니다.', true); await loadOverview() } catch (error) { showMessage(error.message) } }))
    const account = $('.admin-accounts')
    account.innerHTML = '<div class="table-head"><span>아이디</span><span>이름</span><span>소속·담당</span><span>권한</span></div>' + overview.accounts.map(item => `<div class="table-row"><span>${escapeHtml(item.username)}</span><strong>${escapeHtml(item.displayName)}</strong><span>${escapeHtml(item.department)}</span><span>${item.role === 'staff' ? '직원' : '시민'}</span></div>`).join('')
  }
  async function loadOverview() { try { overview = await api('/api/admin/overview'); render() } catch (error) { showMessage(error.message) } }
  $('#notice-form')?.addEventListener('submit', async event => { event.preventDefault(); const formElement = event.currentTarget; const form = new FormData(formElement); try { await api('/api/admin/notices', { method: 'POST', body: JSON.stringify({ kind: form.get('kind'), title: form.get('title'), body: form.get('body') }) }); formElement.reset(); showMessage('공지를 등록했습니다.', true); await loadOverview() } catch (error) { showMessage(error.message) } })
  loadOverview()
}
