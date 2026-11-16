<%@ page contentType="text/html; charset=UTF-8" pageEncoding="UTF-8" %>
<%@ page import="static com.sejongnuri.lab.JspUtil.h" %>
<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title><%= h(request.getAttribute("pageTitle")) %></title><link rel="stylesheet" href="/assets/styles.css"></head>
<body data-page="login"><%@ include file="fragments/header.jspf" %><main class="shell auth-layout">
  <section class="auth-story"><p>세종누리 시민지원 통합포털</p><h1>내 생활에 필요한 서비스를<br>한곳에서 이용하세요.</h1><span>민원 신청과 처리 조회, 문서 발급, 시민 의견까지 편리하게 이용할 수 있습니다.</span><img src="/assets/images/civic-hero.png" alt="시민지원센터 일러스트"></section>
  <section class="auth-card"><div class="auth-icon"><svg><use href="/assets/icons.svg#user"/></svg></div><h2>세종누리 로그인</h2><p>세종누리 계정으로 로그인하고 서비스를 이용하세요.</p>
    <form id="login-form" class="stack-form"><label>아이디<input name="username" autocomplete="username" placeholder="아이디를 입력하세요" required autofocus></label><label>비밀번호<input name="password" type="password" autocomplete="current-password" placeholder="비밀번호를 입력하세요" required></label><div class="form-message" role="alert" hidden></div><button class="primary-button" type="submit">로그인 <svg><use href="/assets/icons.svg#arrow-right"/></svg></button></form>
    <div class="auth-help"><svg><use href="/assets/icons.svg#shield"/></svg> 계정 이용에 관한 안내는 담당자에게 문의하세요.</div>
    <details class="account-check"><summary>계정 등록 여부 확인</summary><p>로그인 전에 아이디가 등록되어 있는지 확인할 수 있습니다.</p><form id="account-check-form"><label>확인할 아이디<input name="accountUsername" autocomplete="off" required></label><button type="submit">등록 여부 확인</button></form><div class="account-check-result" role="status"></div></details>
    <a class="text-link" href="/services">이용 가능한 서비스 보기</a>
  </section>
</main><%@ include file="fragments/footer.jspf" %><script src="/assets/app.js" defer></script></body></html>
