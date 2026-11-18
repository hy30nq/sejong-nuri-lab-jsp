<%@ page contentType="text/html; charset=UTF-8" pageEncoding="UTF-8" %>
<%@ page import="java.util.Map" %><%@ page import="static com.sejongnuri.lab.JspUtil.h" %>
<%
  String section = String.valueOf(request.getAttribute("section"));
  Map<String,Object> civicUser = (Map<String,Object>) request.getAttribute("user");
  String[] info = new String[]{"서비스 이용 상태", "세종누리 서비스 연결 상태를 확인합니다."};
  if ("account".equals(section)) info = new String[]{"내 정보", "내 계정과 이용 중인 시민 서비스를 확인합니다."};
  else if ("complaints".equals(section)) info = new String[]{"나의 민원", "신청한 민원과 처리 내용을 조회합니다."};
  else if ("board".equals(section)) info = new String[]{"시민 의견 게시판", "생활 속 불편과 제안을 시민들과 공유합니다."};
  else if ("documents".equals(section)) info = new String[]{"공개 자료실", "시민 서비스 안내 문서를 내려받거나 관련 링크를 확인합니다."};
  else if ("attachments".equals(section)) info = new String[]{"증빙자료 첨부", "신청에 필요한 사진과 증빙자료를 등록합니다."};
  else if ("certificates".equals(section)) info = new String[]{"결과문서 발급", "신청 내역에 대한 확인서를 조회하고 발급합니다."};
  else if ("settings".equals(section)) info = new String[]{"알림 설정", "민원 처리 소식을 받을 방법을 설정합니다."};
  else if ("identity".equals(section)) info = new String[]{"본인 확인", "중요 서비스 이용 전에 계정을 확인합니다."};
%>
<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title><%= h(request.getAttribute("pageTitle")) %></title><link rel="stylesheet" href="/assets/styles.css"></head>
<body data-page="civic" data-section="<%= h(section) %>"><%@ include file="fragments/header.jspf" %><main class="shell inner-page civic-page">
  <header class="page-heading compact"><h1><%= h(info[0]) %></h1><p><%= h(info[1]) %></p></header>
  <div class="workspace-layout"><%@ include file="fragments/sidenav.jspf" %><section class="workspace-content" aria-label="<%= h(info[0]) %> 업무 내용"><div class="form-message global-message" role="status" hidden></div>

  <% if ("account".equals(section)) { %>
    <section class="panel profile-panel"><svg><use href="/assets/icons.svg#user"/></svg><div><h2><%= h(civicUser.get("displayName")) %>님, 안녕하세요.</h2><p>아이디 <%= h(civicUser.get("username")) %> · 담당 <%= h(civicUser.get("department")) %></p></div></section>
    <% if ("staff".equals(civicUser.get("role"))) { %><section class="panel"><h2>운영 담당자 메모</h2><p><%= h(civicUser.get("trainingNote")) %></p><a class="text-link" href="/admin">포털 관리로 이동</a></section><% } %>
    <div class="action-list"><a href="/apply">새 민원 신청 <svg><use href="/assets/icons.svg#arrow-right"/></svg></a><a href="/complaints">나의 민원 <svg><use href="/assets/icons.svg#arrow-right"/></svg></a><a href="/documents">공개 자료실 <svg><use href="/assets/icons.svg#arrow-right"/></svg></a><a href="/certificates">결과문서 발급 <svg><use href="/assets/icons.svg#arrow-right"/></svg></a></div>

  <% } else if ("complaints".equals(section)) { %>
    <section class="panel"><h2>접수번호로 민원 조회</h2><form class="inline-form" id="receipt-form"><label>민원 접수번호<input name="receiptNo" placeholder="예: APP-1001" required></label><button class="primary-button">조회하기</button></form></section>
    <section class="panel"><div class="panel-heading"><div><h2>신청 내역</h2><p>제목을 선택하면 접수 내용을 확인할 수 있습니다.</p></div><a class="secondary-button" href="/apply">새 민원 신청</a></div><div class="data-table application-table"><div class="table-head"><span>접수번호</span><span>민원 제목</span><span>처리 상태</span><span>작업</span></div><div id="application-rows"></div></div></section>
    <section class="panel application-detail" id="application-detail" hidden></section>

  <% } else if ("board".equals(section)) { %>
    <section class="panel"><h2>새 의견 등록</h2><p>생활 속 불편한 점이나 개선 제안을 남겨주세요.</p><form class="stack-form" id="board-form"><label>의견 내용<textarea name="content" rows="4" maxlength="3000" placeholder="의견을 입력하세요" required></textarea></label><button class="primary-button">의견 등록</button></form></section>
    <section class="panel"><h2>시민 의견</h2><div class="post-list" id="board-posts"></div></section>

  <% } else if ("documents".equals(section)) { %>
    <section class="panel"><h2>공개 안내자료</h2><p>제공 중인 시민 서비스 안내자료를 확인하세요.</p><div class="document-row"><svg><use href="/assets/icons.svg#file"/></svg><span><strong>세종누리 자료실 이용 안내</strong><small>일반 시민 대상 · TXT</small></span><button class="secondary-button" data-document-download>내용 미리보기</button></div></section>
    <section class="panel"><h2>관련 링크 미리보기</h2><form class="inline-form" id="preview-form"><label>페이지 주소<input name="url" type="url" value="http://guide.sejongnuri.internal/info" required></label><button class="primary-button">미리보기</button></form></section>

  <% } else if ("attachments".equals(section)) { %>
    <section class="panel"><h2>증빙자료 등록</h2><p>민원 접수에 필요한 자료를 첨부해 주세요. 파일당 최대 2 MB입니다.</p><form class="stack-form" id="upload-form"><label>파일 선택<input name="attachment" type="file" required></label><button class="primary-button">파일 등록</button></form><a class="text-link upload-link" target="_blank" rel="noreferrer" hidden>등록한 파일 보기</a></section>

  <% } else if ("certificates".equals(section)) { %>
    <section class="panel"><h2>발급 신청 내역</h2><p>승인이 완료된 문서만 전자증명서로 발급할 수 있습니다.</p><div class="certificate-list" id="certificate-list"></div></section>

  <% } else if ("settings".equals(section)) { %>
    <section class="panel"><h2>처리 알림</h2><p>민원 접수와 처리 결과를 이메일로 받아보세요.</p><div class="setting-row"><svg><use href="/assets/icons.svg#bell"/></svg><span><strong>이메일 알림</strong><small>접수·처리 단계가 변경될 때 알림</small></span><button class="secondary-button" id="email-setting">불러오는 중</button></div></section>

  <% } else if ("identity".equals(section)) { %>
    <section class="panel"><h2>휴대전화 본인 확인</h2><p>등록된 휴대전화로 무작위 8자리 인증번호를 전송했습니다. 3분 안에 입력해 주세요.</p><div class="identity-state" id="identity-state"><svg><use href="/assets/icons.svg#shield"/></svg><span><strong>본인 확인 전</strong><small>인증번호 확인 후 일부 서비스를 이용할 수 있습니다.</small></span></div><form class="stack-form" id="identity-form"><label>인증번호<input name="code" inputmode="numeric" pattern="[0-9]{8}" maxlength="8" placeholder="8자리 인증번호" required></label><button class="primary-button">본인 확인</button></form></section>

  <% } else { %>
    <section class="panel"><h2>서비스 연결 상태</h2><p>세종누리 주요 서비스의 현재 운영 상태입니다.</p><div class="health-card" id="health-card"><svg><use href="/assets/icons.svg#wifi"/></svg><span><small>세종누리 시민지원 통합포털</small><strong>상태 확인 중</strong></span><i></i><button class="secondary-button" id="health-refresh">새로고침</button></div><p class="health-time" id="health-time">상태 정보를 불러오는 중입니다.</p></section>
  <% } %>
  </section></div>
</main><%@ include file="fragments/footer.jspf" %><script src="/assets/app.js?v=20261118-3" defer></script></body></html>
