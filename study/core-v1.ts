// core-v1: /list → /detail (push) 해피 케이스만 남긴 Core
// 원본: packages/route-stack/src/core/core.ts (678줄)
//
// 남긴 것: 화면 목록, resolve → commit → change → (슬라이드 재생) → settle
// 뺀 것: 스와이프, 뒤로가기 방향, 슬라이드 도중 이동, 리다이렉트, 블로커,
//        stale 렌더, sameScreen, 스크롤 저장, progress, prune

interface Screen {
  id: number; // React key로 쓰는 내부 번호
  path: string;
  historyId: number | null; // 이 화면이 연결된 히스토리 항목 (commit 때 정해짐)
}

// 원본 history/의 entries를 아주 단순하게 흉내 낸 것
interface Entries {
  // 지금 히스토리 항목의 번호
  // 원본: entries.screenOf(entries.current().key)
  currentHistoryId(): number;
}

// 원본 transition/slide.ts의 slide()가 돌려주는 리모컨
interface SlideControl {
  play(): Promise<boolean>; // 끝까지 재생. 끝까지 갔으면 true
  end(): void; // 레이어를 내리고 원래 자리로 정리
}

type Slide = (to: HTMLElement, from: HTMLElement) => SlideControl;

export class CoreV1 {
  private committed: Screen[] = []; // 확정된 화면들
  private pending: Screen | null = null; // 렌더 중인 새 화면 (아직 미확정)
  private shownId: number | null = null; // 지금 보이는 화면
  private seq = 0; // 다음 화면 id
  private run: { control: SlideControl; to: number } | null = null; // 진행 중인 슬라이드

  constructor(
    private entries: Entries,
    private slide: Slide,
    private host: (id: number) => HTMLElement, // 화면 id → DOM 요소
  ) {}

  /** 렌더 중: 이 path를 어느 화면에 그릴지. 아무것도 확정하지 않는다. */
  resolve(path: string): number {
    const historyId = this.entries.currentHistoryId();

    // ① 지금 히스토리 항목에 이미 연결된 화면이 있으면 그 화면
    const kept = this.committed.find((s) => s.historyId === historyId);
    if (kept) return kept.id;

    // ② 없으면 새 화면. 같은 path로 다시 렌더되면 같은 pending을 재사용
    if (this.pending?.path !== path)
      this.pending = { id: this.seq++, path, historyId: null };
    return this.pending.id;
  }

  /** 그릴 화면 목록 (최신이 앞) */
  screens(): readonly Screen[] {
    return [...this.committed, ...(this.pending ? [this.pending] : [])].reverse();
  }

  /** React가 DOM에 반영한 뒤: 이제 진짜로 확정한다. */
  commit(id: number) {
    const from = this.shown();
    const to =
      this.pending?.id === id
        ? this.pending
        : this.committed.find((s) => s.id === id);
    if (!to) return;

    // 새 화면이면 히스토리 항목과 연결하고 목록에 넣는다
    if (to === this.pending) {
      to.historyId = this.entries.currentHistoryId();
      this.committed.push(to);
      this.pending = null;
    }

    // 앱의 첫 화면: 슬라이드 없이 보여주기만
    if (!from) {
      this.shownId = to.id;
      return;
    }

    // 같은 화면이 다시 렌더됨 (state 변경 등): 할 일 없음
    if (from === to) return;

    // 보이는 화면이 바뀜 → 슬라이드
    this.shownId = to.id;
    this.change(from, to);
  }

  /** 보이는 화면이 바뀌었다: 슬라이드를 시작한다. */
  private change(from: Screen, to: Screen) {
    const control = this.slide(this.host(to.id), this.host(from.id));
    this.run = { control, to: to.id };

    // 원본은 play() → played() → settle() 세 함수. 여기선 합쳤다.
    void control.play().then((done) => {
      if (done) this.settle();
    });
  }

  /** 슬라이드의 유일한 출구: 정리하고 쉬는 상태로 돌아간다. */
  private settle() {
    this.run?.control.end();
    this.run = null;
  }

  private shown() {
    return this.committed.find((s) => s.id === this.shownId);
  }
}
