# Zodiac research notes (design 3 §3.10-3.11, Q47, Q48, Q50)

Read 2026-10-22, read-only. First pass on hosts the owner approved by name (`www.britannica.com`, `vi.wikipedia.org`, `en.wikipedia.org`, `www.informatik.uni-leipzig.de`); second pass under the owner's general read-only approval the same day ("read anything useful, install nothing"): `github.com`, `download.geonames.org`, `data.iana.org`, `www.hko.gov.hk`, plus web searches. Nothing was installed; the HKO PDFs were downloaded to a scratch folder outside the repo and parsed with the Python standard library. Pages were read through a summarizing fetch tool, so quotes are the tool's extraction and tables should be checked again against the page before they become seed data or test fixtures. Plan §R lists these sources; this file holds the facts.

Status marks: **verified** = stated on a page read here (two pages agree where noted); **unverified** = from memory or one unclear source, to be checked before use.

## Sources

| # | Page | Result |
|---|---|---|
| S1 | https://www.britannica.com/topic/zodiac | **Not read: HTTP 403** (the site blocks automated readers). The owner can read it in a browser; nothing from it is used here |
| S2 | https://vi.wikipedia.org/wiki/Mười_hai_con_giáp | Read |
| S3 | https://www.informatik.uni-leipzig.de/~duc/amlich/ and `…/calrules.html` | **Not read: HTTP 404** (Hồ Ngọc Đức's pages seem to have moved). Owner also found nothing there |
| S4 | https://en.wikipedia.org/wiki/Vietnamese_calendar | Read |
| S5 | https://en.wikipedia.org/wiki/Astrological_sign | Read (first 100k characters) |
| S6 | https://vi.wikipedia.org/wiki/Địa_chi | Read |
| S7 | https://vi.wikipedia.org/wiki/Tết_Nguyên_Đán | Read (two parts) |
| S8 | https://en.wikipedia.org/wiki/Ascendant | Read |
| S9 | https://en.wikipedia.org/wiki/Sexagenary_cycle | Read (first 100k characters) |
| S10 | https://en.wikipedia.org/wiki/Earthly_Branches | Read |
| S11 | https://en.wikipedia.org/wiki/Time_in_Vietnam | Read (page is tagged as needing citations) |
| S12 | https://en.wikipedia.org/wiki/Chinese_zodiac | Read; its compatibility grid did not extract cleanly |
| S13 | https://en.wikipedia.org/wiki/Wuxing_(Chinese_philosophy) | Read |
| S14 | https://en.wikipedia.org/wiki/Chinese_calendar | Read (first 100k characters) |
| S15 | https://vi.wikipedia.org/wiki/Can_Chi | Read |
| S16 | https://en.wikipedia.org/wiki/Wikipedia:Reusing_Wikipedia_content | Read |
| S17 | https://en.wikipedia.org/wiki/March_15 · https://vi.wikipedia.org/wiki/15_tháng_3 | Read as samples of "on this day" pages (Q50) |
| — | `vi.wikipedia.org/wiki/Lục_thập_hoa_giáp`, `…/Nạp_âm` | HTTP 404 (wrong titles); nạp âm came from S13 instead |
| S18 | https://github.com/cosinekitty/astronomy | Read (README) |
| S19 | https://download.geonames.org/export/dump/readme.txt | Read |
| S20 | https://data.iana.org/time-zones/tzdb/asia | Read (Vietnam section) |
| S21 | Hong Kong Observatory "Gregorian-Lunar Calendar Conversion Table of <year>", https://www.hko.gov.hk/en/gts/time/calendar/pdf/files/<year>e.pdf, 1920-1983 | Downloaded and parsed (64 files) |
| S22 | Sun sign-entry checks: https://universalworkshop.com/sun-entering-signs-and-constellations (2020), https://cafeastrology.com/astrologyof2010horoscopes.html (2010, via search summary), a Belgian calendar page via search summary (2024) | Read / search summaries |
| S24 | https://github.com/cosinekitty/astronomy/tree/master/source/js | Read (first 100k characters of the JS API list) |
| S25 | https://en.wikipedia.org/wiki/List_of_meteor_showers | Read |
| S23 | Web search "tam hợp lục hợp lục hại tứ hành xung" → https://luatminhkhue.vn/tam-hop-la-gi-tu-hanh-xung-la-gi.aspx, https://www.dienmayxanh.com/kinh-nghiem-hay/tam-hop-la-gi-tu-hanh-xung-la-gi-1588018 and others | Search summary only (pages not opened) |
| — | `archive.aeon.org` (an article on the Pisces cut-off) | DNS failure, not read |

## 1. Western zodiac

**Signs are 30° sectors of the ecliptic, starting at the March equinox** (tropical zodiac), not the constellations; precession has moved them apart. The equinox falls between 19 and 21 March, so boundary dates move by about a day from year to year (S5, verified). Our `western_sign` therefore needs either the Sun's ecliptic longitude at the birth moment (exact) or the conventional table below plus a cusp note (design 3 E41).

Conventional table (S5, "approximate"; verified):

| Sign | From | To | Element | Modality |
|---|---|---|---|---|
| Aries | 21 Mar | 20 Apr | Fire | Cardinal |
| Taurus | 21 Apr | 21 May | Earth | Fixed |
| Gemini | 22 May | 21 Jun | Air | Mutable |
| Cancer | 22 Jun | 23 Jul | Water | Cardinal |
| Leo | 24 Jul | 23 Aug | Fire | Fixed |
| Virgo | 24 Aug | 23 Sep | Earth | Mutable |
| Libra | 24 Sep | 23 Oct | Air | Cardinal |
| Scorpio | 24 Oct | 22 Nov | Water | Fixed |
| Sagittarius | 23 Nov | 21 Dec | Fire | Mutable |
| Capricorn | 22 Dec | 20 Jan | Earth | Cardinal |
| Aquarius | 21 Jan | 19 Feb | Air | Fixed |
| Pisces | 20 Feb | 20 Mar | Water | Mutable |

Other tables in common use shift some boundaries by a day; many give Pisces as 19 Feb-20 Mar. **The fixed table is wrong in some years**, so it is not used for the stored sign.

**The Sun's real entry times** (S22, checked against our own calculation). A short script using Meeus's low-precision solar formula (*Astronomical Algorithms*, ch. 25, about 0.01°; standard library only) gives the Sun reaching 330° (Pisces) at:

| Year | Computed (UTC) | Published | Difference |
|---|---|---|---|
| 2010 | 18 Feb 18:31 | 18 Feb 1:36 pm US Eastern = 18:36 UTC (S22, search summary; minute resolution) | 5 min |
| 2020 | 19 Feb 04:59 | 19 Feb, hour 5 UT (S22, page read; **hour resolution only**) | consistent with the hour, no more |
| 2024 | 19 Feb 04:11 | 19 Feb 05:13 Belgian time = 04:13 UTC (S22, search summary; another site said 11:03 UTC, so sources disagree) | 2 min |

**What this does and does not show:** three Pisces points, two of them from search summaries and one only to the hour. It supports the conclusion that the entry moves across 18-19 Feb; it does **not** validate the formula to the minute or for the other 11 boundaries. The script is a planning check kept outside the repo (no code in this phase); its formula is cited above.

Computed for every year 1920-2030, the Pisces entry falls between 18 Feb 09:09 and 19 Feb 22:29 UTC, and the Capricorn (270°) entry between 21 Dec 08:25 and 22 Dec 20:52 UTC. So 19 Feb is Pisces for the whole local day in Vietnam in some years and partly Aquarius in others: the owner's sources that call 19 Feb Pisces are right for many years, but not all.

**Decision (replaces the table rule):** the stored `western_sign` always comes from the Sun's ecliptic longitude, computed by the library (§6) and checked in Phase 1 tests: all 12 sign entries for a sample of years (at least 1920, 1968, 2000, 2030 and every year with a published point) against an authoritative ephemeris (JPL Horizons or the US Naval Observatory, host to approve then), tolerance ±2 minutes; the Meeus formula is a second, independent check. With date, time and place: the sign at that instant. With the date only: compute the entry time for that year; if it falls outside the local day (birthplace zone, else UTC+7), the sign is certain; if it falls inside that day, show "on the cusp, add the birth time" and store the sign for local noon. Until those tests pass, the rule is a design decision, not a validated result.

**Library check (§7):** Astronomy Engine gives the Pisces entry as 18 Feb 2010 18:35, 19 Feb 2020 04:57 and 19 Feb 2024 04:13 UTC, within 1-4 minutes of the Meeus script and of the minute-resolution published points. Sign entry ranges over 1920-2030 (library, UTC):

| Sign | Earliest | Latest |
|---|---|---|
| Aries | 20 Mar 02:17 | 21 Mar 15:28 |
| Taurus | 19 Apr 13:09 | 21 Apr 03:05 |
| Gemini | 20 May 12:09 | 22 May 02:45 |
| Cancer | 20 Jun 20:01 | 22 Jun 11:02 |
| Leo | 22 Jul 06:53 | 23 Jul 22:00 |
| Virgo | 22 Aug 14:00 | 24 Aug 04:51 |
| Libra | 22 Sep 11:45 | 24 Sep 02:03 |
| Scorpio | 22 Oct 21:13 | 24 Oct 10:50 |
| Sagittarius | 21 Nov 18:54 | 23 Nov 07:53 |
| Capricorn | 21 Dec 08:20 | 22 Dec 20:53 |
| Aquarius | 19 Jan 19:01 | 21 Jan 08:04 |
| Pisces | 18 Feb 09:07 | 19 Feb 22:28 |

Every boundary moves across about a day and a half, so every sign has years where a "table" day is wrong. The comparison against an authoritative ephemeris (JPL Horizons or USNO) is still a Phase 1 test.

**Moon sign:** the Moon moves about 12-13° a day, so it changes sign every 2-2.5 days (**unverified**, from memory; S5 does not cover it). Needs the library. Rule from design 3 stays: with the date only, show the Moon sign only if it is the same at 00:00 and 24:00 local time.

**Ascendant (rising sign)** (S8, verified): the ecliptic longitude rising on the eastern horizon at birth. Inputs: exact birth time → local sidereal time θL (which needs the longitude), latitude φ, obliquity ε (23.4392911° at J2000.0).
Formula as given: `λAsc = arctan(−cos θL / (sin θL cos ε + tan φ sin ε))`, quadrant fixed with `atan2`, then the rising (not setting) point chosen. A sign takes about 2 hours to rise, varying with latitude. Above the polar circles it is undefined for some degrees; our place list should stay below about 66° latitude, or the screen should say "rising sign not available here".

## 2. Vietnamese 12 con giáp

**Branches, animals, yin/yang, element, hours** (S2, S6, S10, S15; elements agree in S2 and S10):

| # | Chi | Vietnamese animal | Âm/Dương | Hành | Giờ (24 h) | Lunar month |
|---|---|---|---|---|---|---|
| 1 | Tý | Chuột | Dương | Thủy | 23-01 | 11 |
| 2 | Sửu | Trâu | Âm | Thổ | 01-03 | 12 |
| 3 | Dần | Hổ | Dương | Mộc | 03-05 | 1 |
| 4 | Mão | Mèo | Âm | Mộc | 05-07 | 2 |
| 5 | Thìn | Rồng | Dương | Thổ | 07-09 | 3 |
| 6 | Tỵ | Rắn | Âm | Hỏa | 09-11 | 4 |
| 7 | Ngọ | Ngựa | Dương | Hỏa | 11-13 | 5 |
| 8 | Mùi | Dê | Âm | Thổ | 13-15 | 6 |
| 9 | Thân | Khỉ | Dương | Kim | 15-17 | 7 |
| 10 | Dậu | Gà | Âm | Kim | 17-19 | 8 |
| 11 | Tuất | Chó | Dương | Thổ | 19-21 | 9 |
| 12 | Hợi | Lợn | Âm | Thủy | 21-23 | 10 |

- Vietnam uses **Mèo** (cat) where China uses the rabbit, and **Trâu** (water buffalo) for Sửu (S4, S12, S15). S15 gives Mùi = dê (goat) and notes Japan uses the sheep. Our EN labels: Rat, Buffalo, Tiger, Cat, Dragon, Snake, Horse, Goat, Monkey, Rooster, Dog, Pig.
- S6 notes the hour boundaries have a tolerance of about ±20 minutes. **Design consequence:** a birth time within 20 minutes of an odd hour gets a "boundary hour" note, like the Western cusp note. Giờ Tý spans midnight (23:00-01:00); whether a 23:xx birth already belongs to the next day's pillar is a school question (**unverified**; pick one rule and state it in the reading).

**Stems (thiên can)** (S9, S15, verified): Giáp, Ất = Mộc; Bính, Đinh = Hỏa; Mậu, Kỷ = Thổ; Canh, Tân = Kim; Nhâm, Quý = Thủy. Odd positions dương, even âm. Year stem from the last digit of the year: Canh 0, Tân 1, Nhâm 2, Quý 3, Giáp 4, Ất 5, Bính 6, Đinh 7, Mậu 8, Kỷ 9 (S15).

**Year pillar** (S9): position in the 60-cycle = `(year − 3) mod 60`, with 0 meaning 60. Check: 1984 → 1 = Giáp Tý; 2026 → 43 = Bính Ngọ, which matches S7's Tết table. The year here is the **lunar** year: a birthday before that year's Tết belongs to the previous year (S9, S7).

**Month pillar** (S9): month 1 is always a Dần month. Its stem depends on the year stem (Giáp/Kỷ year → Bính Dần; Ất/Canh → Mậu Dần; Bính/Tân → Canh Dần; Đinh/Nhâm → Nhâm Dần; Mậu/Quý → Giáp Dần), then it advances one step a month. S9 says the month branches follow the **solar terms** (Dần starts at lập xuân, about 4 Feb), not the lunar month. **Open choice:** solar-term months (the tứ trụ convention) or lunar months (what most Vietnamese calendars print). Proposal: solar terms for the pillar, and show the lunar date as well.

**Day pillar** (S9): a continuous 60-day cycle. Reference days given: 1 Oct 1949 = Giáp Tý; 18 Feb 1912 = Giáp Tý. Implementation: day pillar = (Julian day number + constant) mod 60, with the constant fixed by those reference days. Unit tests use both dates.

**Hour pillar** (S9): the Tý hour's stem depends on the day stem (Giáp/Kỷ day → Giáp Tý; Ất/Canh → Bính Tý; Bính/Tân → Mậu Tý; Đinh/Nhâm → Canh Tý; Mậu/Quý → Nhâm Tý), then it advances one step every 2 hours.

**Mệnh by nạp âm** (S13; each name covers two consecutive can chi; VI names are the standard Sino-Vietnamese readings of the characters, **to confirm against a VI source**):

| Pair | Can chi | Nạp âm | Hành |
|---|---|---|---|
| 1 | Giáp Tý, Ất Sửu | Hải Trung Kim 海中金 | Kim |
| 2 | Bính Dần, Đinh Mão | Lư Trung Hỏa 爐中火 | Hỏa |
| 3 | Mậu Thìn, Kỷ Tỵ | Đại Lâm Mộc 大林木 | Mộc |
| 4 | Canh Ngọ, Tân Mùi | Lộ Bàng Thổ 路旁土 | Thổ |
| 5 | Nhâm Thân, Quý Dậu | Kiếm Phong Kim 劍鋒金 | Kim |
| 6 | Giáp Tuất, Ất Hợi | Sơn Đầu Hỏa 山頭火 | Hỏa |
| 7 | Bính Tý, Đinh Sửu | Giản Hạ Thủy 澗下水 | Thủy |
| 8 | Mậu Dần, Kỷ Mão | Thành Đầu Thổ 城頭土 | Thổ |
| 9 | Canh Thìn, Tân Tỵ | Bạch Lạp Kim 白鑞金 | Kim |
| 10 | Nhâm Ngọ, Quý Mùi | Dương Liễu Mộc 楊柳木 | Mộc |
| 11 | Giáp Thân, Ất Dậu | Tuyền Trung Thủy 泉中水 | Thủy |
| 12 | Bính Tuất, Đinh Hợi | Ốc Thượng Thổ 屋上土 | Thổ |
| 13 | Mậu Tý, Kỷ Sửu | Tích Lịch Hỏa 霹靂火 | Hỏa |
| 14 | Canh Dần, Tân Mão | Tùng Bách Mộc 松柏木 | Mộc |
| 15 | Nhâm Thìn, Quý Tỵ | Trường Lưu Thủy 長流水 | Thủy |
| 16 | Giáp Ngọ, Ất Mùi | Sa Trung Kim 沙中金 | Kim |
| 17 | Bính Thân, Đinh Dậu | Sơn Hạ Hỏa 山下火 | Hỏa |
| 18 | Mậu Tuất, Kỷ Hợi | Bình Địa Mộc 平地木 | Mộc |
| 19 | Canh Tý, Tân Sửu | Bích Thượng Thổ 壁上土 | Thổ |
| 20 | Nhâm Dần, Quý Mão | Kim Bạch Kim 金箔金 | Kim |
| 21 | Giáp Thìn, Ất Tỵ | Phú Đăng Hỏa 覆燈火 | Hỏa |
| 22 | Bính Ngọ, Đinh Mùi | Thiên Hà Thủy 天河水 | Thủy |
| 23 | Mậu Thân, Kỷ Dậu | Đại Dịch Thổ 大驛土 | Thổ |
| 24 | Canh Tuất, Tân Hợi | Thoa Xuyến Kim 釵釧金 | Kim |
| 25 | Nhâm Tý, Quý Sửu | Tang Đố Mộc 桑柘木 | Mộc |
| 26 | Giáp Dần, Ất Mão | Đại Khê Thủy 大溪水 | Thủy |
| 27 | Bính Thìn, Đinh Tỵ | Sa Trung Thổ 沙中土 | Thổ |
| 28 | Mậu Ngọ, Kỷ Mùi | Thiên Thượng Hỏa 天上火 | Hỏa |
| 29 | Canh Thân, Tân Dậu | Thạch Lựu Mộc 石榴木 | Mộc |
| 30 | Nhâm Tuất, Quý Hợi | Đại Hải Thủy 大海水 | Thủy |

The element column comes from the last character of each name (金 Kim, 火 Hỏa, 木 Mộc, 土 Thổ, 水 Thủy). Pair 23 (驛 = Dịch) is also seen as "Đại Trạch Thổ" in some Vietnamese lists; **confirm**.

**Element cycles** (S13, verified): sinh (generating) Mộc → Hỏa → Thổ → Kim → Thủy → Mộc. Khắc (overcoming) Mộc → Thổ → Thủy → Hỏa → Kim → Mộc. Same element = hòa.

**Branch relations** (partly verified):

| Relation | Groups | Status |
|---|---|---|
| Tam hợp (three harmonies) | Thân-Tý-Thìn (Thủy cục); Tỵ-Dậu-Sửu (Kim cục); Dần-Ngọ-Tuất (Hỏa cục); Hợi-Mão-Mùi (Mộc cục) | **Verified** (S12, S23) |
| Lục xung (six clashes; branches 6 apart) | Tý-Ngọ, Sửu-Mùi, Dần-Thân, Mão-Dậu, Thìn-Tuất, Tỵ-Hợi | Tý-Ngọ and Sửu-Mùi verified (S12); the rest follow the "6 apart" pattern, **unverified** |
| Tứ hành xung (four-way clash) | Tý-Ngọ-Mão-Dậu; Thìn-Tuất-Sửu-Mùi; Dần-Thân-Tỵ-Hợi | **Verified** (S23, several Vietnamese pages agree) |
| Lục hợp (six pairs) | Tý-Sửu, Dần-Hợi, Mão-Tuất, Thìn-Dậu, Tỵ-Thân, Ngọ-Mùi | Tý-Sửu verified (S12); rest **unverified** (S23's summary gives the same list but says no source confirmed it) |
| Lục hại (six harms) | Tý-Mùi, Sửu-Ngọ, Dần-Tỵ, Mão-Thìn, Thân-Hợi, Dậu-Tuất | Tý-Mùi and Sửu-Ngọ verified (S12); rest **unverified** |

Lục hợp, lục hại and the remaining lục xung pairs still need a readable source before they become seed data; until then the reading uses tam hợp, tứ hành xung and the mệnh relation only.

## 3. The lunar calendar and Tết

**Rules** (S14, S4, verified): months start on the day of the astronomical new moon in the reference time zone; the month containing the winter solstice is month 11; in a year with 13 new moons between two month-11s, the first month without a major solar term (trung khí) is the leap month; the new year is usually the second (sometimes the third) new moon after the winter solstice. Vietnam computes in **UTC+7** (S4, S14), China in UTC+8, so the dates can differ.

**Tết range:** never before 21 January or after 20 February (S7).

**Vietnam vs China differences found:**
- **1985:** Tết **21 Jan 1985** in Vietnam (S4 and S7 agree; **verified**) and 20 Feb 1985 in China (S4). The calendars realigned after a Vietnamese leap month (S4: 21 Mar to 19 Apr 1985). S4's explanation, as extracted, says month 11 ran 22 Dec 1984 to 20 Jan 1985 with the solstice on 21 Dec; that contradicts the month-11 rule above and skips month 12, so the extraction is garbled. **Explanation unverified:** reconcile the new-moon and solstice times by computing them (§6 library) before using this year as anything but a Tết-date fixture.
- **1968 (verified, S4, S7):** North Vietnam switched the calendar to UTC+7 by a decree of 8 Aug 1967; the South still used UTC+8. Tết Mậu Thân was 29 Jan in the North and 30 Jan in the South.
- **Before 1967** Vietnam used UTC+8 for the lunar calendar (S7); the South kept UTC+8 until 1975. Both used UTC+7 from 1976 (S7).
- 2007 and 2030: S7's table gives 17 Feb 2007 and 2 Feb 2030 for Vietnam. That China's dates were a day later (18 Feb 2007, 3 Feb 2030) is from memory, **unverified**.

**Consequence for our calculator (new, needs an owner decision):** "UTC+7 for every year" is wrong before 1968. To match what families actually celebrated, the calculator should use UTC+8 for dates before the 1967 decree (North) and before 1976 (South). Since the birthplace is known, the rule can follow it. Simpler alternative: UTC+8 before 1968, UTC+7 after, plus a note for a southern birth from 1968 to 1975. This becomes **Q51** in the PRD.

**Independent Tết table for the unit test:** S7 has 1984-2091 (UTC+7). Rows inside our range (1984-2030), d/m/yyyy:

| | | | | | |
|---|---|---|---|---|---|
| 1984 2/2 | 1985 21/1 | 1986 9/2 | 1987 29/1 | 1988 17/2 | 1989 6/2 |
| 1990 27/1 | 1991 15/2 | 1992 4/2 | 1993 23/1 | 1994 10/2 | 1995 31/1 |
| 1996 19/2 | 1997 7/2 | 1998 28/1 | 1999 16/2 | 2000 5/2 | 2001 24/1 |
| 2002 12/2 | 2003 1/2 | 2004 22/1 | 2005 9/2 | 2006 29/1 | 2007 17/2 |
| 2008 7/2 | 2009 26/1 | 2010 14/2 | 2011 3/2 | 2012 23/1 | 2013 10/2 |
| 2014 31/1 | 2015 19/2 | 2016 8/2 | 2017 28/1 | 2018 16/2 | 2019 5/2 |
| 2020 25/1 | 2021 12/2 | 2022 1/2 | 2023 22/1 | 2024 10/2 | 2025 29/1 |
| 2026 17/2 | 2027 6/2 | 2028 26/1 | 2029 13/2 | 2030 2/2 | |

**1920-1983 from the Hong Kong Observatory** (S21; Chinese calendar, UTC+8). Under Q51, Vietnamese births before 1968 use UTC+8, so these rows are a valid independent check for **1920-1967**. For 1968-1983 they are only the China reference (Vietnam used UTC+7, the South UTC+8 until 1975). Parsed by script; 1938, 1957 and 1976 were read by hand.

| | | | | | | | |
|---|---|---|---|---|---|---|---|
| 1920 20/2 | 1921 8/2 | 1922 28/1 | 1923 16/2 | 1924 5/2 | 1925 24/1 | 1926 13/2 | 1927 2/2 |
| 1928 23/1 | 1929 10/2 | 1930 30/1 | 1931 17/2 | 1932 6/2 | 1933 26/1 | 1934 14/2 | 1935 4/2 |
| 1936 24/1 | 1937 11/2 | 1938 31/1 | 1939 19/2 | 1940 8/2 | 1941 27/1 | 1942 15/2 | 1943 5/2 |
| 1944 25/1 | 1945 13/2 | 1946 2/2 | 1947 22/1 | 1948 10/2 | 1949 29/1 | 1950 17/2 | 1951 6/2 |
| 1952 27/1 | 1953 14/2 | 1954 3/2 | 1955 24/1 | 1956 12/2 | 1957 31/1 | 1958 18/2 | 1959 8/2 |
| 1960 28/1 | 1961 15/2 | 1962 5/2 | 1963 25/1 | 1964 13/2 | 1965 2/2 | 1966 21/1 | 1967 9/2 |
| *1968 30/1* | *1969 17/2* | *1970 6/2* | *1971 27/1* | *1972 15/2* | *1973 3/2* | *1974 23/1* | *1975 11/2* |
| *1976 31/1* | *1977 18/2* | *1978 7/2* | *1979 28/1* | *1980 16/2* | *1981 5/2* | *1982 25/1* | *1983 13/2* |

Italic = China reference only. 1968 matches S4/S7 for the South (30 Jan); the North was 29 Jan.

**Coverage now (Q52):** independent reference tables exist for 1920-1967 (S21) and 1984-2030 (S7). **Research-level comparison done (§7), 0 mismatches:** all 64 HKO rows 1920-1983 computed in UTC+8, and all 47 S7 rows 1984-2030 computed in UTC+7 (111 comparisons). For Q52 this covers Vietnamese births 1920-1967 (UTC+8) and southern births 1968-1975 (UTC+8, Q51). The HKO rows for 1968-1983 test the algorithm in UTC+8 only; **UTC+7 years 1968-1983 stay uncompared** (northern births 1968-1983, southern 1976-1983). The Phase 1 test repeats it on the real code; only years that pass there count as cross-checked in the product.

Computed UTC+7 Tết for the uncovered years 1968-1983 (not cross-checked): 1968 29/1 (matches the North, S4/S7), **1969 16/2 (UTC+8: 17/2)**, 1970 6/2, 1971 27/1, 1972 15/2, 1973 3/2, 1974 23/1, 1975 11/2, 1976 31/1, 1977 18/2, 1978 7/2, 1979 28/1, 1980 16/2, 1981 5/2, 1982 25/1, 1983 13/2. Computed differences elsewhere: 1985 21/1 vs 20/2, 2007 17/2 vs 18/2, 2030 2/2 vs 3/2 (UTC+7 vs UTC+8), confirming the memory-based 2007 and 2030 claims above by calculation (not by publication). Still "calculated, not cross-checked": UTC+7 years 1968-1983 (and southern births 1968-1975 use the S21 row, per Q51). A Vietnamese printed source exists (search result: Nguyễn Văn Chung, *Lịch Âm Dương Việt Nam 1900-2010*, NXB Văn Hóa Dân Tộc, 2007) but is not online.

## 4. Vietnam's time offsets (for the birth time)

S11 (verified that the page says this; the page is poorly sourced): local mean time UTC+7:06:40 before 1 Jul 1906; +7:06:30 to 30 Apr 1911; +7 to 30 Dec 1942; **+8** 31 Dec 1942 to 13 Mar 1945; **+9** (Tokyo) 14 Mar to 1 Sep 1945; +7 from 2 Sep 1945. North: +7 (with +8 in some zones 1947-1954), +7 from 1 Jan 1968. South: +8 to 30 Jun 1955; +7 1 Jul 1955 to 31 Dec 1959; **+8** 1 Jan 1960 to 12 Jun 1975; +7 since 13 Jun 1975.
IANA (S20, read in the tz source file itself), verbatim:
```
Zone Asia/Ho_Chi_Minh	7:06:30 -	LMT	1906 Jul  1
			7:06:30	-	PLMT	1911 May  1 # Phù Liễn MT
			7:00	-	%z	1942 Dec 31 23:00
			8:00	-	%z	1945 Mar 14 23:00
			9:00	-	%z	1945 Sep  1 24:00
			7:00	-	%z	1947 Apr  1
			8:00	-	%z	1955 Jul  1 01:00
			7:00	-	%z	1959 Dec 31 23:00
			8:00	-	%z	1975 Jun 13
			7:00	-	%z
```
The comments say this zone follows the **South** and matches all of Vietnam since 1975-06-13; North Vietnam back to 1970 uses `Asia/Bangkok`, and before 1970 `Asia/Hanoi` in the `backzone` file (not in the default build). The 1967 lunar-calendar decree is not a clock change and is not in the tz data.
**Conflict:** S11 says +7 for the "standard zone" from Sep 1945, while tzdb has +8 from 1 Apr 1947 to 1 Jul 1955 (French-controlled areas). **Decision:** for a birth time, use the birthplace's IANA zone (southern places → `Asia/Ho_Chi_Minh`; northern places before 1970 → build with `backzone` so `Asia/Hanoi` exists, to verify at install). The lunar calendar's offset follows Q51, separately from the clock.
Note: the **civil-time** history (S11: North +7 from 1968) and the **calendar** switch (S4: decree of 8 Aug 1967) are different things; the calculator needs both. **To verify** against the IANA source file itself (host `data.iana.org` or `github.com/eggert/tz`, not yet approved).

## 5. Q50: the sky at birth

**Owner clarification (2026-10-22):** "event" means the sky at the birth moment: the Moon phase, the planets, and sky events. The first reading (encyclopedia "on this day" history) is withdrawn. What it taught is kept: sample date pages (S17) had a suitable same-year event for neither test date, and their text is CC BY-SA, so it would have needed attribution. The sky version needs neither.

**What the library computes offline** (S24, Astronomy Engine JS API list; names to recheck in the full reference at install):
- Moon: `MoonPhase` (phase as an angle, mapped to 8 names), `Illumination` (phase angle and magnitude), `SearchMoonQuarter`, `SearchLunarApsis` (perigee, for a "supermoon" flag).
- Positions: `EclipticLongitude`, `GeoVector`, `Ecliptic`, `Equator`, `Horizon` (above or below the horizon at the birthplace), `SunPosition`.
- Events: `Seasons` (equinoxes, solstices), `SearchLunarEclipse`, `SearchGlobalSolarEclipse`, `SearchLocalSolarEclipse`, `SearchTransit`, `SearchRelativeLongitude` (conjunctions, oppositions), `SearchMaxElongation`, `SearchPlanetApsis`, `SearchRiseSet`.
- Not seen in the part read: `SiderealTime` and `SearchMoonPhase`; the ascendant is computed with the S8 formula if needed.

**Meteor showers** (S25, the list says its peaks come from the International Meteor Organization; dates shown are for 2026 and move by a day or two between years):

| Shower | Active | Peak | ZHR | Parent |
|---|---|---|---|---|
| Quadrantids | 28 Dec - 12 Jan | 3 Jan | 80 | 2003 EH1 (uncertain) |
| Lyrids | 14 - 30 Apr | 22 Apr | 18 | C/1861 G1 Thatcher |
| Eta Aquariids | 19 Apr - 28 May | 6 May | 50 | 1P/Halley |
| Southern Delta Aquariids | 12 Jul - 23 Aug | 31 Jul | 25 | P/2008 Y12 |
| Perseids | 17 Jul - 24 Aug | 13 Aug | 100 | 109P/Swift-Tuttle |
| October Draconids | 6 - 10 Oct | 9 Oct | 5 | 21P/Giacobini-Zinner |
| Orionids | 2 Oct - 7 Nov | 21 Oct | 20 | 1P/Halley |
| Southern Taurids | 20 Sep - 20 Nov | 5 Nov | 7 | 2P/Encke |
| Northern Taurids | 20 Oct - 10 Dec | 12 Nov | 5 | 2004 TG10 |
| Leonids | 6 - 30 Nov | 17 Nov | 15 | 55P/Tempel-Tuttle |
| Geminids | 4 - 20 Dec | 14 Dec | 150 | 3200 Phaethon |
| Ursids | 17 - 26 Dec | 22 Dec | 10 | 8P/Tuttle |

These are facts, stored in our own wording with the source in `zodiac_ref_sources`; the text says "around the peak". Historic outbursts (for example strong Leonid years) are out of scope.

**Without a birth time:** the Moon moves about 12-13° a day, so the phase name rarely changes within a day but the Moon's sign may (design 3 rule: "needs birth time"). Values are computed for local noon and marked approximate.

**Privacy:** planet positions together pin the exact date, so the whole sky block is a detailed value, published only with the per-partner opt-in.

**3D:** the owner prefers 3D for this (design 5). Inputs it needs are already in `birth_sky`: Moon phase angle, ecliptic longitudes, event kinds.

## 6. Libraries, data sets and what is still open

| Topic | Candidate | Host to approve | Note |
|---|---|---|---|
| Astronomy library (Sun longitude, Moon, ascendant, new moons, solar terms) | **Astronomy Engine** (Don Cross) | read S18 | **MIT licence**; JavaScript (browser and Node), Python, C, C#, Kotlin; no dependencies beyond the standard library; claims ±1 arcminute, tested against NOVAS and JPL Horizons; seasons and Moon phases built in. Sidereal time and ascendant not named in the README: check the API docs, else compute the ascendant with the S8 formula. Owner approved the install 2026-10-22 "if safe"; vetted and installed in a scratch folder outside the repo (§7). Swiss Ephemeris is AGPL or commercial (avoid) |
| Birthplace list (name, lat, lon, IANA zone) | **GeoNames** `cities15000` (about 25,000 places, population > 15,000 plus capitals) | read S19 | **CC BY 4.0** (attribution required: credit GeoNames with a licence link in the app's credits); `timezone` column is an IANA id. Add all Vietnamese provinces even if smaller (`cities1000` has 130,000 rows) |
| IANA tz data | `asia` file | read S20 | Done, §4 |
| Tết 1968-1983 for UTC+7 | a Vietnamese table | none online found | §3 |
| Lục hợp, lục hại | a readable source | to be found | §2 |

Reference texts (EN/VI readings) are written by us from these facts after the gaps above close, labelled "for fun / theo quan niệm dân gian", with every source listed in `zodiac_ref_sources`.

## 7. Library validation (2026-10-22)

**Vetting before install** (registry `registry.npmjs.org`, read with `npm view`): `astronomy-engine` 2.1.19, MIT, author Donald Cross, maintainer `cosinekitty` (matches the GitHub repository S18), **no dependencies, no install scripts**, registry signature present, last published 2023-12-14. Installed pinned (`--save-exact`, `--ignore-scripts`) in a scratch folder outside the repo; `npm audit signatures`: 1 package, verified signature; 0 vulnerabilities; integrity `sha512-8yWKNf7U…X6w==` matches the registry. Nothing is installed in the repo (no code in this phase).

**Checks run (general years only, no personal dates):**
- Functions present: `SiderealTime`, `SearchMoonPhase`, `SearchSunLongitude`, `Ecliptic`, plus those in §5.
- Moon: full Moon 23 Apr 2024 23:49 UTC and new Moon 8 Apr 2024 18:21 UTC, as published (times from memory of the eclipse and full Moon; they agree to the minute).
- Sun signs: §1.
- Tết: rules of §3 (new moons, winter solstice in month 11, leap month = first without a major term), 0 mismatches:

| Source | Years | Offset computed | Rows |
|---|---|---|---|
| HKO (S21) | 1920-1983 | UTC+8 | 64 |
| Vietnamese table (S7) | 1984-2030 | UTC+7 | 47 |

  No UTC+7 comparison exists for 1968-1983 (Q52 gap).

The scratch scripts are not part of the repo; Phase 1 writes the real tests first (RED), using these results as fixtures.
