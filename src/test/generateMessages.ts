const fs = require("fs");

function generateMessages(count: number) {
  const messages = [];
  for (let i = 0; i < count; i++) {
    const msgId = `202505141607490000000${Math.floor(100000 + Math.random() * 900000)}`;
    const passportNum = `FA${Math.floor(100000000 + Math.random() * 900000000)}`;
    const nationalityCode = `${Math.floor(100 + Math.random() * 900)}`; // קוד לאום רנדומלי
    const msgType = Math.random() < 0.5 ? "DELETE" : "UPSERT"; // 50% DELETE, 50% UPSERT
    const msgDate = new Date(
      Date.now() - Math.floor(Math.random() * 10000000000)
    ).toISOString(); // תאריך רנדומלי

    const message = {
      msg_id: msgId,
      msg_ver: 1,
      msg_type: msgType,
      msg_date: msgDate,
      msg_hash: null,
      msg_data: [
        {
          foreign_key: `${nationalityCode}_${passportNum}`,
          alerts: null,
          Deposits: [],
          deposit_files: null,
          Employers: {
            agency_name: null,
            agency_num: null,
            employer_name: "DETIMIL GNIREENIGNE YTIROIRP",
            employer_num: "820273",
            end_date: "2023-08-05T00:00:00",
            IssuePermitBureau: "DETIMIL GNIREENIGNE YTIROIRP",
            IssuePermitWorkerName: null,
            PermitStartDate: "2023-05-11T00:00:00",
            reason_for_ending: "לא רשום",
            start_date: "2023-05-11T00:00:00",
          },
          Employers_per_visa: {
            current_employer_name: "DETIMIL GNIREENIGNE YTIROIRP",
            current_employer_num: "820273",
          },
          Entries_and_exits: [
            {
              entry_date: "2023-05-09T00:00:00",
              exit_date: "1111-11-11T00:00:00",
              nationality: "POLAND",
              passport_num: passportNum,
              visa_type: "ב/2/B",
            },
          ],
          General_details: {
            arrival: "2",
            birth_date: "1998-06-19T00:00:00",
            cellphone: null,
            fathers_name: null,
            gender: "זכר",
            given_name: "MACIEJ JERZY",
            in_israel: true,
            nationality: "POLAND",
            nationalityCode: nationalityCode,
            Ovd_LicenseEndDate: null,
            Ovd_LicenseStartDate: null,
            passport_num: passportNum,
            picture:
              "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",
          },
          Last_visa_details: {
            category_description: null,
            date_of_issue: null,
            extension: null,
            inter_visa: 1,
            sub_visa: null,
            valid_date_intervisa: "2023-08-05T00:00:00",
            valid_to: "2026-08-05T00:00:00",
            visa_category: null,
            visa_num: null,
          },
          Passports: [
            {
              nationality: "POLAND",
              nationalityCode: nationalityCode,
              parent: null,
              passport_num: passportNum,
              valid_until: "2026-08-05T00:00:00",
            },
          ],
          updatedAt: "2025-06-03T21:00:00.000Z",
          updatedAtFullTime: "2025-06-04T08:04:48.150Z",
          Visas: [
            {
              category_description: null,
              date_of_issue: null,
              extension: null,
              passport_num: passportNum,
              sub_visa: null,
              valid_from: null,
              valid_to: null,
              visa_category: null,
            },
          ],
          Work_permit: {
            area: null,
            sector: null,
            work_permit: null,
            work_permit_num: "432624608",
          },
        },
      ],
    };

    messages.push(message);
  }
  return messages;
}

// Generate 10,000 messages and save to a file
const messages = generateMessages(100);
fs.writeFileSync("./LotMessages.json", JSON.stringify(messages, null, 2));
console.log("Generated 10,000 messages in messages_leah.json");
