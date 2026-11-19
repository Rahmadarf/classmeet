import { describe, expect, it } from "vitest";
import {
  backoffMs,
  failureReason,
  failureText,
  MAX_AUTO_ATTEMPTS,
  parseJobs,
  serializeJobs,
  successText,
  type PayoutJob,
} from "./queue";

const job: PayoutJob = {
  requestId: "3f2c1a9e-7b44-4d0a-9c55-1e2d3c4b5a69",
  teamId: "076c5a05-7636-4423-9832-3be25d4b8c13",
  teamName: "Tim Cakra",
  amount: 300_000,
  status: "sending",
  attempts: 3,
  reason: null,
};

describe("teks hasil", () => {
  it("sukses dan gagal mengikuti Figma", () => {
    expect(successText(job)).toBe("Rp 300.000 terkirim ke Tim Cakra");
    expect(failureText({ ...job, teamName: "Tim Elang", reason: "pos tidak tersedia" })).toBe(
      "Gagal: pos tidak tersedia. Hadiah Rp 300.000 untuk Tim Elang belum terkirim.",
    );
  });

  it("alasan dari kode dikenal, selain itu dari pesan", () => {
    expect(failureReason("post_closed", "Pos sedang tidak tersedia.")).toBe("pos tidak tersedia");
    expect(failureReason(null, "Koneksi bermasalah. Coba lagi.")).toBe("koneksi bermasalah");
    expect(failureReason("lain", "")).toBe("terjadi kesalahan");
  });
});

describe("backoff", () => {
  it("naik lalu mendatar", () => {
    expect([0, 1, 2, 3, 4, 9].map(backoffMs)).toEqual([2000, 4000, 8000, 15000, 30000, 30000]);
    expect(MAX_AUTO_ATTEMPTS).toBe(5);
  });
});

describe("antrean tersimpan", () => {
  it("bolak-balik; percobaan dimulai dari 0", () => {
    const [back] = parseJobs(serializeJobs([job]));
    expect(back).toEqual({ ...job, attempts: 0 });
  });

  it("gagal tetap gagal dengan alasannya", () => {
    const failed: PayoutJob = { ...job, status: "failed", reason: "pos tidak tersedia" };
    expect(parseJobs(serializeJobs([failed]))[0]).toMatchObject({
      status: "failed",
      reason: "pos tidak tersedia",
    });
  });

  it("membuang entri rusak, ganda, atau berisi nominal tidak sah", () => {
    const text = JSON.stringify([
      job,
      job,
      { ...job, requestId: "bukan-uuid" },
      { ...job, requestId: "11111111-1111-4111-8111-111111111111", amount: 0 },
      { ...job, requestId: "22222222-2222-4222-8222-222222222222", amount: 1.5 },
      null,
      "x",
    ]);
    expect(parseJobs(text)).toHaveLength(1);
    expect(parseJobs("{")).toEqual([]);
    expect(parseJobs(null)).toEqual([]);
    expect(parseJobs('{"a":1}')).toEqual([]);
  });
});
