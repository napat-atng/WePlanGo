import { formatThaiDate } from "@/lib/thai-date";
import { ThaiDateInput } from "@/components/ui/ThaiDateInput";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  addDateOption, addPlaceOption, editDateOption, editPlaceOption, openVoting, removeOption,
  submitDateVotes, submitPlaceVotes,
} from "./actions";
import { tallyVotes, type Participant } from "./tally";
import { isBeforeDeadline, isDeadlineNear } from "./time";
import { zonedInputValue } from "@/features/trips/time";

type Trip = {
  id: string;
  status: string;
  organizer_id: string;
  vote_deadline: string;
  timezone: string;
};

export async function VotingSection({
  trip,
  userId,
  participants,
  groupUserIds,
  names,
}: {
  trip: Trip;
  userId: string;
  participants: Participant[];
  groupUserIds: string[];
  names: Map<string, string>;
}) {
  const supabase = await createServerSupabaseClient();
  const [datesResult, placesResult, dateVotesResult, placeVotesResult, submissionsResult] = await Promise.all([
    supabase.from("date_options").select("id, starts_on, ends_on").eq("trip_id", trip.id).order("starts_on"),
    supabase.from("place_options").select("id, name, address, map_url").eq("trip_id", trip.id).order("created_at"),
    supabase.from("date_votes").select("option_id, user_id, response").eq("trip_id", trip.id),
    supabase.from("place_votes").select("option_id, user_id").eq("trip_id", trip.id),
    supabase.from("vote_submissions").select("user_id, date_submitted_at, place_submitted_at").eq("trip_id", trip.id),
  ]);
  const dates = datesResult.data ?? [];
  const places = placesResult.data ?? [];
  const dateVotes = dateVotesResult.data ?? [];
  const placeVotes = placeVotesResult.data ?? [];
  const submissions = submissionsResult.data ?? [];
  const summary = tallyVotes({
    participants,
    groupUserIds,
    dateOptionIds: dates.map((option) => option.id),
    placeOptionIds: places.map((option) => option.id),
    dateVotes,
    placeVotes,
    submissions,
  });
  const myParticipation = participants.find((person) => person.user_id === userId);
  const canPropose = trip.status === "draft" && myParticipation?.invitation_status !== "declined" && !!myParticipation;
  const canSubmit = trip.status === "voting" && isBeforeDeadline(trip.vote_deadline)
    && myParticipation?.invitation_status !== "declined" && !!myParticipation;
  const isOrganizer = trip.organizer_id === userId;
  const myDateVotes = new Map(dateVotes.filter((vote) => vote.user_id === userId)
    .map((vote) => [vote.option_id, vote.response]));
  const myPlaceVotes = new Set(placeVotes.filter((vote) => vote.user_id === userId)
    .map((vote) => vote.option_id));
  const mySubmission = submissions.find((item) => item.user_id === userId);
  const deadlineSoon = canSubmit && isDeadlineNear(trip.vote_deadline);
  const needsAnswer = !mySubmission?.date_submitted_at || !mySubmission?.place_submitted_at;
  const visibleParticipants = participants.filter((person) => groupUserIds.includes(person.user_id));
  const dateAnswers = new Map(dateVotes.map((vote) => [`${vote.user_id}:${vote.option_id}`, vote.response]));
  const selectedPlaces = new Map(visibleParticipants.map((person) => [
    person.user_id,
    places.filter((place) => placeVotes.some((vote) =>
      vote.user_id === person.user_id && vote.option_id === place.id)).map((place) => place.name),
  ]));
  const submissionByUser = new Map(submissions.map((item) => [item.user_id, item]));
  const latestValidDate = [
    zonedInputValue(new Date().toISOString(), trip.timezone).slice(0, 10),
    zonedInputValue(trip.vote_deadline, trip.timezone).slice(0, 10),
  ].sort().at(-1) ?? "";
  const hasInvalidDates = dates.some((option) => option.ends_on < latestValidDate);
  const leadingDateCount = Math.max(0, ...summary.dates.map((item) => item.available));
  const leadingPlaceCount = Math.max(0, ...summary.places.map((item) => item.selected));

  return (
    <section id="vote-section" className="group-list">
      <h2>ผลโหวตและตัวเลือก</h2>
      <p className="section-intro">{trip.status === "draft" ? "ช่วยกันเสนอวันและสถานที่ ก่อนผู้จัดเปิดโหวต" : trip.status === "voting" ? "ดูผลของกลุ่มและเลือกคำตอบของคุณก่อนหมดเวลา" : "ย้อนดูผลโหวตที่ใช้ประกอบการเลือกแผน"}</p>
      {deadlineSoon && needsAnswer && <p className="form-note" role="status">
        ใกล้ปิดโหวตแล้ว: {`${!mySubmission?.date_submitted_at ? "ตอบวัน" : ""}${!mySubmission?.date_submitted_at && !mySubmission?.place_submitted_at ? "และ" : ""}${!mySubmission?.place_submitted_at ? "ตอบสถานที่" : ""}`}ก่อนกำหนด
      </p>}
      {trip.status === "voting" && !canSubmit && !isBeforeDeadline(trip.vote_deadline)
        && <p>หมดเวลาโหวตแล้ว รอผู้จัดสรุปแผน</p>}
      {trip.status === "voting" && <div className="vote-summary">
        <h3>การตอบของกลุ่ม</h3>
        <div className="response-progress"><span>วันเดินทาง <strong>{summary.dateSubmittedCount}/{summary.eligibleCount}</strong></span><span>สถานที่ <strong>{summary.placeSubmittedCount}/{summary.eligibleCount}</strong></span></div>
        {!!summary.datePendingUserIds.length && <p>ยังไม่ตอบวัน: {summary.datePendingUserIds.map((id) => names.get(id) ?? id.slice(0, 8)).join(", ")}</p>}
        {!!summary.placePendingUserIds.length && <p>ยังไม่ตอบสถานที่: {summary.placePendingUserIds.map((id) => names.get(id) ?? id.slice(0, 8)).join(", ")}</p>}
      </div>}
      <h3 className="result-heading">วันเดินทาง <span>{dates.length} ตัวเลือก</span></h3>
      {dates.length ? <ul className="result-list">{dates.map((option) => {
        const counts = summary.dates.find((item) => item.id === option.id);
        return <li key={option.id} className="result-item">
          <div className="result-item-top"><strong>{formatThaiDate(option.starts_on)}{option.ends_on !== option.starts_on && ` – ${formatThaiDate(option.ends_on)}`}</strong>
          {trip.status !== "draft" && (counts?.available ?? 0) === leadingDateCount && leadingDateCount > 0 && <span className="leader-tag">ว่างมากที่สุด</span>}</div>
          {trip.status !== "draft" && <div className="result-counts" aria-label={`ว่าง ${counts?.available ?? 0} อาจว่าง ${counts?.maybe ?? 0} ไม่ว่าง ${counts?.unavailable ?? 0}`}>
            <span className="count-available"><b>{counts?.available ?? 0}</b> ว่าง</span>
            <span className="count-maybe"><b>{counts?.maybe ?? 0}</b> อาจว่าง</span>
            <span className="count-unavailable"><b>{counts?.unavailable ?? 0}</b> ไม่ว่าง</span>
          </div>}
          {isOrganizer && trip.status === "draft" && <form action={removeOption}>
            <input type="hidden" name="tripId" value={trip.id} />
            <input type="hidden" name="optionId" value={option.id} />
            <input type="hidden" name="kind" value="date" />
            <button type="submit" className="text-button">ลบตัวเลือก</button>
          </form>}
          {isOrganizer && trip.status === "draft" && <details>
            <summary>แก้ตัวเลือก</summary>
            <form action={editDateOption} className="group-form">
              <input type="hidden" name="tripId" value={trip.id} />
              <input type="hidden" name="optionId" value={option.id} />
              <label>วันเริ่ม<ThaiDateInput name="startsOn" type="date" required defaultValue={option.starts_on} /></label>
              <label>วันสิ้นสุด<ThaiDateInput name="endsOn" type="date" required defaultValue={option.ends_on} /></label>
              <button type="submit" className="primary-button">บันทึก</button>
            </form>
          </details>}
        </li>;
      })}</ul> : <div className="empty-state"><p>ยังไม่มีตัวเลือกวัน เพิ่มวันที่อยากไปด้านล่าง</p></div>}
      {canPropose && <form action={addDateOption} className="group-form">
        <input type="hidden" name="tripId" value={trip.id} />
        <label htmlFor="date-start">วันเริ่ม</label>
        <ThaiDateInput id="date-start" name="startsOn" type="date" required />
        <label htmlFor="date-end">วันสิ้นสุด</label>
        <ThaiDateInput id="date-end" name="endsOn" type="date" required />
        <p className="field-hint">วันสิ้นสุดต้องไม่ผ่านมาแล้ว และต้องไม่ก่อนวันปิดโหวตของทริป</p>
        <button type="submit" className="primary-button">เสนอวัน</button>
      </form>}

      <h3 className="result-heading">สถานที่ <span>{places.length} ตัวเลือก</span></h3>
      {places.length ? <ul className="result-list">{places.map((option) => {
        const counts = summary.places.find((item) => item.id === option.id);
        return <li key={option.id} className="result-item">
          <div className="result-item-top"><strong>{option.name}</strong>
          {trip.status !== "draft" && (counts?.selected ?? 0) === leadingPlaceCount && leadingPlaceCount > 0 && <span className="leader-tag">คนเลือกมากที่สุด</span>}</div>
          {option.address && <span>{option.address}</span>}
          {option.map_url && <a href={option.map_url} target="_blank" rel="noopener noreferrer">เปิดแผนที่</a>}
          {trip.status !== "draft" && <span className="place-count"><b>{counts?.selected ?? 0}</b> คนเลือก</span>}
          {isOrganizer && trip.status === "draft" && <form action={removeOption}>
            <input type="hidden" name="tripId" value={trip.id} />
            <input type="hidden" name="optionId" value={option.id} />
            <input type="hidden" name="kind" value="place" />
            <button type="submit" className="text-button">ลบตัวเลือก</button>
          </form>}
          {isOrganizer && trip.status === "draft" && <details>
            <summary>แก้ตัวเลือก</summary>
            <form action={editPlaceOption} className="group-form">
              <input type="hidden" name="tripId" value={trip.id} />
              <input type="hidden" name="optionId" value={option.id} />
              <label>ชื่อสถานที่<input name="name" required maxLength={160} defaultValue={option.name} /></label>
              <label>ที่อยู่<input name="address" maxLength={500} defaultValue={option.address ?? ""} /></label>
              <label>ลิงก์แผนที่<input name="mapUrl" type="url" maxLength={1000} defaultValue={option.map_url ?? ""} /></label>
              <button type="submit" className="primary-button">บันทึก</button>
            </form>
          </details>}
        </li>;
      })}</ul> : <div className="empty-state"><p>ยังไม่มีตัวเลือกสถานที่ เสนอที่ที่อยากไปด้านล่าง</p></div>}
      {canPropose && <form action={addPlaceOption} className="group-form">
        <input type="hidden" name="tripId" value={trip.id} />
        <label htmlFor="place-name">ชื่อสถานที่</label>
        <input id="place-name" name="name" required maxLength={160} />
        <label htmlFor="place-address">ที่อยู่ (ไม่บังคับ)</label>
        <input id="place-address" name="address" maxLength={500} />
        <label htmlFor="place-map">ลิงก์แผนที่ (ไม่บังคับ)</label>
        <input id="place-map" name="mapUrl" type="url" maxLength={1000} />
        <button type="submit" className="primary-button">เสนอสถานที่</button>
      </form>}

      {isOrganizer && trip.status === "draft" && <form action={openVoting}>
        <input type="hidden" name="tripId" value={trip.id} />
        <button className="primary-button" type="submit" disabled={!dates.length || !places.length || hasInvalidDates || !isBeforeDeadline(trip.vote_deadline)}>
          เปิดโหวตและล็อกตัวเลือก
        </button>
        {(!dates.length || !places.length) && <p className="field-hint">เพิ่มวันและสถานที่อย่างน้อยอย่างละหนึ่งตัวเลือกก่อนเปิดโหวต</p>}
        {hasInvalidDates && <p className="field-hint">มีตัวเลือกวันที่สิ้นสุดก่อนวันปิดโหวตหรือผ่านมาแล้ว แก้หรือลบตัวเลือกนั้นก่อน</p>}
        {!isBeforeDeadline(trip.vote_deadline) && <p className="field-hint">เวลาปิดโหวตผ่านไปแล้ว ผู้จัดต้องแก้เวลาปิดโหวตให้เป็นอนาคตก่อน</p>}
      </form>}

      {trip.status !== "draft" && <div className="response-matrix">
        <h3>คำตอบของเพื่อนแต่ละคน</h3>
        <p className="section-intro">“ยังไม่ตอบ” ต่างจาก “ไม่ว่าง” และคนที่ไม่ร่วมทริปจะไม่ถูกนับในยอดรวม</p>
        <div className="table-scroll">
          <table>
            <thead><tr>
              <th scope="col">เพื่อน</th>
              {dates.map((option) => <th scope="col" key={option.id}>{formatThaiDate(option.starts_on)}{option.ends_on !== option.starts_on && ` – ${formatThaiDate(option.ends_on)}`}</th>)}
              <th scope="col">สถานที่ที่เลือก</th>
            </tr></thead>
            <tbody>{visibleParticipants.map((person) => {
              const submission = submissionByUser.get(person.user_id);
              const declined = person.invitation_status === "declined";
              const placeNames = selectedPlaces.get(person.user_id) ?? [];
              return <tr key={person.user_id}>
                <th scope="row">{names.get(person.user_id) ?? person.user_id.slice(0, 8)}
                  <small>{declined ? "ไม่ร่วมทริป" : person.invitation_status === "pending"
                    ? "รอตอบคำเชิญ" : "ร่วมทริป"}</small>
                </th>
                {dates.map((option) => {
                  const answer = dateAnswers.get(`${person.user_id}:${option.id}`);
                  const state = declined ? "excluded" : !submission?.date_submitted_at ? "pending" : answer ?? "pending";
                  return <td key={option.id}><span className="answer-state" data-answer={state}>{declined ? "ไม่นับ" : state === "available" ? "ว่าง" : state === "maybe" ? "อาจว่าง" : state === "unavailable" ? "ไม่ว่าง" : "ยังไม่ตอบ"}</span></td>;
                })}
                <td>{declined ? "ไม่นับ" : !submission?.place_submitted_at ? "ยังไม่ตอบ"
                  : placeNames.length ? placeNames.join(", ") : "ไม่มีที่ที่เลือก"}</td>
              </tr>;
            })}</tbody>
          </table>
        </div>
      </div>}

      {canSubmit && <>
        <form action={submitDateVotes} className="vote-form">
          <h3>วันไหนสะดวกบ้าง</h3>
          <input type="hidden" name="tripId" value={trip.id} />
          {dates.map((option) => <fieldset key={option.id}>
            <legend>{formatThaiDate(option.starts_on)}{option.ends_on !== option.starts_on && ` – ${formatThaiDate(option.ends_on)}`}</legend>
            {(["available", "maybe", "unavailable"] as const).map((answer) => <label key={answer}>
              <input type="radio" name={`date-${option.id}`} value={answer} required defaultChecked={myDateVotes.get(option.id) === answer} />
              {answer === "available" ? "ว่าง" : answer === "maybe" ? "อาจว่าง" : "ไม่ว่าง"}
            </label>)}
          </fieldset>)}
          <button className="primary-button" type="submit">{mySubmission?.date_submitted_at ? "แก้คำตอบวัน" : "ส่งคำตอบวัน"}</button>
        </form>
        <form action={submitPlaceVotes} className="vote-form">
          <h3>สถานที่ที่สนใจ</h3>
          <p>เลือกได้หลายแห่ง หรือกด “ไม่มีที่ที่ต้องการ” ด้านล่าง</p>
          <input type="hidden" name="tripId" value={trip.id} />
          {places.map((option) => <label key={option.id}>
            <input type="checkbox" name="placeId" value={option.id} defaultChecked={myPlaceVotes.has(option.id)} />
            {option.name}
          </label>)}
          <button className="primary-button" type="submit">{mySubmission?.place_submitted_at ? "แก้คำตอบสถานที่" : "ส่งคำตอบสถานที่"}</button>
        </form>
        <form action={submitPlaceVotes}>
          <input type="hidden" name="tripId" value={trip.id} />
          <p className="field-hint">หากไม่สนใจสถานที่ใด ปุ่มนี้จะบันทึกคำตอบและแทนที่สถานที่ที่เคยเลือก</p>
          <button className="secondary-button" type="submit">บันทึกว่าไม่เลือกสถานที่ใด</button>
        </form>
      </>}
    </section>
  );
}
