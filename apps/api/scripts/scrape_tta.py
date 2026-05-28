"""
TTA 정보통신용어사전 스크래퍼 (1회 실행용)
용어를 수집해서 apps/api/data/tta_terms.txt 로 저장한다.

실행 방법:
  cd apps/api
  .venv/bin/python scripts/scrape_tta.py
"""
import asyncio
import json
import re
from pathlib import Path

from playwright.async_api import async_playwright, Route, Request

OUTPUT = Path(__file__).parent.parent / "data" / "tta_terms.txt"
OUTPUT.parent.mkdir(exist_ok=True)

# 수집된 용어 저장
_collected: set[str] = set()


def _extract_from_html(html: str) -> list[str]:
    """렌더링된 HTML에서 용어 추출."""
    terms = re.findall(r'dictionaryView\.do\?word_seq=\d+[^>]*>\s*([^<]+?)\s*</a>', html)
    return [t.strip() for t in terms if t.strip() and t.strip() not in ("더보기",)]


def _extract_from_json(data: dict) -> list[str]:
    """AJAX JSON 응답에서 용어 추출."""
    terms = []
    for key in data:
        section = data[key]
        if isinstance(section, dict):
            for item in section.get("list", []) or []:
                word = item.get("kor_subject") or item.get("eng_subject") or item.get("word")
                if word:
                    terms.append(word.strip())
    return terms


async def scrape_initial_char(page, char: str) -> list[str]:
    """초성/알파벳 하나에 해당하는 용어 전체 수집."""
    terms: list[str] = []

    async def handle_response(response):
        if "searchOtherList" in response.url or "searchList" in response.url:
            try:
                ct = response.headers.get("content-type", "")
                if "json" in ct:
                    data = await response.json()
                    terms.extend(_extract_from_json(data))
            except Exception:
                pass

    page.on("response", handle_response)

    try:
        await page.goto(
            "https://terms.tta.or.kr/dictionary/searchFirstList.do",
            wait_until="domcontentloaded",
            timeout=15_000,
        )
        await page.evaluate(f"fn_firstWord('{char}')")
        await page.wait_for_timeout(2000)

        # 페이지 수가 있으면 순회
        page_num = 1
        while True:
            await page.wait_for_timeout(1000)
            html = await page.content()
            found = _extract_from_html(html)
            terms.extend(found)

            # 다음 페이지 버튼 확인
            next_btn = await page.query_selector("a.next, .paging a:last-child, [title='다음']")
            if not next_btn or not found:
                break
            await next_btn.click()
            page_num += 1
            if page_num > 50:  # 안전 상한
                break

    except Exception as e:
        print(f"  [{char}] 오류: {e}")
    finally:
        page.remove_listener("response", handle_response)

    return list(set(terms))


async def main():
    ko_chars = list("ㄱㄴㄷㄹㅁㅂㅅㅇㅈㅊㅋㅌㅍㅎ")
    en_chars = list("ABCDEFGHIJKLMNOPQRSTUVWXYZ")
    all_chars = ko_chars + en_chars

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context()
        page = await context.new_page()

        for char in all_chars:
            print(f"수집 중: {char} ...", end=" ", flush=True)
            terms = await scrape_initial_char(page, char)
            _collected.update(terms)
            print(f"{len(terms)}개 (누적 {len(_collected)}개)")

        await browser.close()

    # 저장
    sorted_terms = sorted(_collected)
    OUTPUT.write_text("\n".join(sorted_terms), encoding="utf-8")
    print(f"\n완료: {len(sorted_terms)}개 → {OUTPUT}")


if __name__ == "__main__":
    asyncio.run(main())
