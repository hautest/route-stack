import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { createPortal } from "react-dom";
import { Header } from "../ui";

export const Route = createFileRoute("/lab")({ component: Lab });

function Lab() {
  const [open, setOpen] = useState(false);
  return (
    <div className="page">
      <Header title="실험실" />
      <div className="lab-sticky">sticky 영역</div>
      <div className="carousel" aria-label="캐러셀">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i}>카드 {i + 1}</div>
        ))}
      </div>
      <div className="inner-scroll" aria-label="내부 스크롤">
        {Array.from({ length: 50 }, (_, i) => (
          <p key={i}>내부 줄 {i + 1}</p>
        ))}
      </div>
      <div className="content">
        <button className="button" onClick={() => setOpen(true)}>
          모달 열기
        </button>
        {Array.from({ length: 40 }, (_, i) => (
          <p key={i}>본문 줄 {i + 1}</p>
        ))}
      </div>
      <div className="fixed-bar">
        <button className="button">화면 하단 버튼</button>
      </div>
      {open &&
        createPortal(
          <div className="modal-backdrop" onClick={() => setOpen(false)}>
            <div className="modal" role="dialog" aria-label="실험실 모달">
              <p>화면이 연 모달입니다.</p>
              <button className="button" onClick={() => setOpen(false)}>
                닫기
              </button>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
