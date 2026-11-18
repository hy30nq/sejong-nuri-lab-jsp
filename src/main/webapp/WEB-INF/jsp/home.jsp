<%@ page contentType="text/html; charset=UTF-8" pageEncoding="UTF-8" %>
<%@ page import="java.util.*" %>
<%@ page import="static com.sejongnuri.lab.JspUtil.h" %>
<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title><%= h(request.getAttribute("pageTitle")) %></title><link rel="stylesheet" href="/assets/styles.css"></head>
<body data-page="home"><%@ include file="fragments/header.jspf" %><main>
  <section class="home-hero">
    <div class="shell hero-inner"><div class="hero-copy"><h1>필요한 시민 서비스를 찾으세요</h1><p>민원 신청부터 생활지원, 처리결과 확인까지 세종누리에서 한 번에 이용할 수 있습니다.</p>
      <form class="hero-search" action="/services" method="get" role="search"><label class="sr-only" for="home-search">민원 및 서비스 검색</label><input id="home-search" name="q" placeholder="서비스명 또는 민원명을 입력해 주세요"><button aria-label="서비스 검색"><svg><use href="/assets/icons.svg#search"/></svg></button></form>
    </div></div>
  </section>
  <div class="shell shortcut-rail" aria-label="주요 서비스 바로가기">
    <a href="/apply"><svg><use href="/assets/icons.svg#file"/></svg><span><strong>민원 신청</strong><small>생활 민원을 온라인으로 신청</small></span><svg><use href="/assets/icons.svg#arrow-right"/></svg></a>
    <a href="/complaints"><svg><use href="/assets/icons.svg#clipboard"/></svg><span><strong>나의 민원 조회</strong><small>신청 내역과 처리 상태 확인</small></span><svg><use href="/assets/icons.svg#arrow-right"/></svg></a>
    <a href="/certificates"><svg><use href="/assets/icons.svg#download"/></svg><span><strong>결과문서 발급</strong><small>처리 완료 문서 확인 및 발급</small></span><svg><use href="/assets/icons.svg#arrow-right"/></svg></a>
    <a href="/identity"><svg><use href="/assets/icons.svg#shield"/></svg><span><strong>본인 확인</strong><small>계정 확인과 인증 절차</small></span><svg><use href="/assets/icons.svg#arrow-right"/></svg></a>
  </div>
  <div class="shell home-grid">
    <section class="open-section"><div class="section-heading"><h2>자주 찾는 서비스</h2><a href="/services">전체 서비스 보기 <svg><use href="/assets/icons.svg#arrow-right"/></svg></a></div><div class="service-rows">
      <a href="/apply"><svg><use href="/assets/icons.svg#file"/></svg><strong>생활 민원 신청</strong><span>생활 속 불편 사항과 지원 신청 접수</span><svg><use href="/assets/icons.svg#arrow-right"/></svg></a>
      <a href="/complaints"><svg><use href="/assets/icons.svg#clipboard"/></svg><strong>나의 민원 조회</strong><span>접수번호로 신청 내역과 처리 상태 확인</span><svg><use href="/assets/icons.svg#arrow-right"/></svg></a>
      <a href="/attachments"><svg><use href="/assets/icons.svg#paperclip"/></svg><strong>증빙자료 첨부</strong><span>신청에 필요한 파일을 온라인으로 등록</span><svg><use href="/assets/icons.svg#arrow-right"/></svg></a>
      <a href="/certificates"><svg><use href="/assets/icons.svg#download"/></svg><strong>결과문서 발급</strong><span>처리된 신청의 결과문서 확인</span><svg><use href="/assets/icons.svg#arrow-right"/></svg></a>
      <a href="/documents"><svg><use href="/assets/icons.svg#file"/></svg><strong>공개 자료실</strong><span>서비스 안내문과 공개 자료 확인</span><svg><use href="/assets/icons.svg#arrow-right"/></svg></a>
      <a href="/board"><svg><use href="/assets/icons.svg#message"/></svg><strong>시민 의견 게시판</strong><span>생활 개선 의견을 작성하고 살펴보기</span><svg><use href="/assets/icons.svg#arrow-right"/></svg></a>
    </div></section>
    <section class="open-section"><div class="section-heading"><h2>공지사항</h2><a href="/notices">전체보기 <svg><use href="/assets/icons.svg#arrow-right"/></svg></a></div><div class="notice-table"><div class="notice-head"><span>구분</span><span>제목</span><span>등록일</span></div>
      <% for (Map<String,Object> notice : (List<Map<String,Object>>) request.getAttribute("notices")) { %><a href="/notices/<%= notice.get("id") %>"><span class="kind <%= "important".equals(notice.get("kind")) ? "important" : "" %>"><%= "important".equals(notice.get("kind")) ? "중요" : "일반" %></span><strong><%= h(notice.get("title")) %></strong><time><%= h(notice.get("date")) %></time></a><% } %>
    </div></section>
  </div>
  <section class="shell help-strip"><div><h2>서비스 이용안내</h2><p>이용에 필요한 내용을 확인하세요.</p></div><a href="/services"><svg><use href="/assets/icons.svg#file"/></svg><span><strong>민원서비스 이용방법</strong><small>신청부터 처리결과 확인까지</small></span><svg><use href="/assets/icons.svg#arrow-right"/></svg></a><a href="/identity"><svg><use href="/assets/icons.svg#shield"/></svg><span><strong>본인 확인 안내</strong><small>계정 확인 절차 알아보기</small></span><svg><use href="/assets/icons.svg#arrow-right"/></svg></a><a href="/status"><svg><use href="/assets/icons.svg#wifi"/></svg><span><strong>서비스 연결 상태</strong><small>포털 이용 상태 확인</small></span><svg><use href="/assets/icons.svg#arrow-right"/></svg></a></section>
</main><%@ include file="fragments/footer.jspf" %><script src="/assets/app.js?v=20261118-3" defer></script></body></html>
