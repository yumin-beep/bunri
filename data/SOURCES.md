# Sources

| File | Source | Notes |
|---|---|---|
| raw_moe_dictionary.tsv | 「재활용품 분리배출 가이드라인」 (Ministry of Environment), appendix "분리배출 품목 사전" pp.27-34. Copy read 2026-11-01 from https://sustainability.korea.ac.kr/files/Separation%20and%20discharge%20guide%20for%20recycling%20items%20(Ministry%20of%20Environment).pdf | Verbatim method text. Three typos in the source fixed (스케이드보드→스케이트보드, 명합지갑→명함지갑, 종투→봉투). Entries whose method column was split across a table in the source (국자, 그릇, 도마, 컵, 쓰레받기, 재떨이, 코르크따개) were not imported from the appendix; 국자·그릇·도마·컵 use the material question instead. Duplicate 전기비데 dropped. The copy has no printed edition date or publisher line. |
| extra_body_items.tsv | Same guideline, body pp.6-15 (23 category rules, 해당/비해당 품목) and 4 material-split rows from pp.28/33 | Verbatim. |
| extra_body_items.tsv (seoul-2024) | 서울특별시 기후환경본부, "[탄소중립 라이프 #8] 탄소 중립을 위한 자원순환! 가정편", 2024-11-08, https://news.seoul.go.kr/env/archives/560708 | 투명페트병, 양파망, 택배 비닐. Seoul rule. |
| updates.tsv, extra_body_items.tsv (kwa2026) | 한국폐기물협회 「2026년도 내 손안의 분리배출 앱 Q&A 사례」, 2026-03-26, pp.11-12 (종이팩, 멸균팩), p.20 (은박 에어캡). Copy read 2026-11-01 at https://www.paju.go.kr/webcontent/ckeditor/2026/4/8/74a0d78c-e755-4152-b2e8-9c5c4d36e980.pdf | Verbatim. Overrides the older guide for cartons; the old sentence stays visible in the app. The booklet carries "무단 전재 또는 복제를 금합니다"; only the short rule sentences are quoted, with attribution. |
| README impact figure | 한국일보, 2024-01-17, https://v.daum.net/v/20240117043046531 | Press source, labelled [press]. |
| README limits (2027 carton rule) | 매일신문, 「종이팩 분리배출 10월 자율 시행…내년 의무화 땐 최대 30만원 과태료」, 2026-10-11, https://www.imaeil.com/page/view/2026101112532787767 (read 2026-11-01) | Press source on a directive still in 행정예고; labelled [press]. |
| method_en.tsv, items.tsv (English) | Unofficial translation | Labelled in the app. |
| eval/queries.tsv, eval/queries_v2.tsv | Written for this project | Synthetic test queries, not real user logs. |
