import React from 'react';

const CRITERIA = {
  group1: [
    { id: 'g1_1', label: 'Attendance punctuality and regularity', max: 6 },
    { id: 'g1_2', label: 'Follow-through on instruction', max: 6 },
    { id: 'g1_3', label: 'Ability to perform under pressure', max: 6 },
    { id: 'g1_4', label: 'Ability to communicate ideas clearly and effectively to others', max: 6 },
    { id: 'g1_5', label: 'Demonstrates a self-motivated approach to work', max: 6 },
    { id: 'g1_6', label: 'Ability to establish appropriate priorities and goals', max: 6 },
    { id: 'g1_7', label: 'Professional interest (Exhibits professional behavior/ attitude)', max: 6 }
  ],
  group2: [
    { id: 'g2_1', label: 'Understanding task at hand', max: 7 },
    { id: 'g2_2', label: 'On-time completion of assigned task', max: 7 },
    { id: 'g2_3', label: 'Pay close attention to details', max: 7 },
    { id: 'g2_4', label: 'Quality of work', max: 7 }
  ],
  group3: [
    { id: 'g3_1', label: 'Ability to accept constructive criticism', max: 6 },
    { id: 'g3_2', label: 'Open-mindedness (willingness to listen and learn)', max: 6 },
    { id: 'g3_3', label: 'Interpersonal relationships with coworkers and supervisors', max: 6 },
    { id: 'g3_4', label: 'Contributes to a team atmosphere', max: 6 },
    { id: 'g3_5', label: 'Demonstrates appropriate behavior', max: 6 }
  ]
};

function resolveMediaUrl(value) {
  if (!value) return '';
  const stringValue = String(value || '').trim();
  if (/^(https?:\/\/|blob:|data:)/i.test(stringValue)) return stringValue;
  if (stringValue.startsWith('/')) return `http://localhost:5000${stringValue}`;
  return stringValue;
}

function toTitleCase(value) {
  return String(value || '')
    .toLowerCase()
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function valueOrDash(value) {
  const text = String(value || '').trim();
  return text || '____________________';
}

function readOnlyInputClassName(extra = '') {
  return [
    'w-full bg-transparent px-1 font-semibold text-black outline-none',
    'disabled:cursor-default disabled:opacity-100 disabled:text-black',
    extra
  ].join(' ');
}

function readOnlyLineClassName(extra = '') {
  return [
    'border-b-2 border-black pb-1',
    extra
  ].join(' ');
}

export function AcceptanceForm({ data, readOnly = false }) {
  const studentName = data?.studentName || data?.fullName || data?.name || '';
  const studentIdNumber = data?.studentIdNumber || data?.idNumber || data?.id_number || '';
  const studentDepartment = data?.studentDepartment || data?.department || '';
  const studentYear = data?.studentYear || '';
  const studentPhone = data?.studentPhone || data?.phone || '';
  const studentEmail = data?.studentEmail || data?.email || '';
  const studentSignature = data?.studentSignature || data?.studentSignatureUrl || data?.student_signature || data?.student_signature_url || '';
  const studentPhoto = data?.studentPhoto || data?.profileImage || '';
  const companyName = data?.companyName || '';
  const placeTown = data?.placeTown || '';
  const contactPerson = data?.contactPerson || '';
  const companyPhone = data?.companyPhone || '';
  const companyEmail = data?.companyEmail || '';
  const representativeName = data?.representativeName || '';
  const representativeSignature = data?.representativeSignature || data?.signatureUrl || data?.digitalSignature || '';
  const representativeDate = data?.representativeDate || '';
  const academicHeader = data?.academicHeader || {};

  return (
    <section className="border-2 border-black bg-white p-10 font-serif text-black shadow-xl print:shadow-none print:border-none">
      <div className="mb-8 flex items-start gap-4">
        <img src="/uog-logo.jpg" alt="University of Gondar Logo" className="h-16 w-16 object-contain" />
        <div className="flex-1 text-center">
          <h1 className="text-3xl font-black">University of Gondar</h1>
          {academicHeader.hasAcademicInfo ? (
            <>
              <h2 className="mt-1 text-2xl font-black">{academicHeader.college}</h2>
              <h3 className="mt-1 text-2xl font-black">{academicHeader.department}</h3>
            </>
          ) : (
            <h2 className="mt-1 text-2xl font-black">{academicHeader.fallback || 'University of Gondar'}</h2>
          )}
          <h4 className="mt-2 text-2xl font-black underline">Internship Acceptance Form</h4>
        </div>
        <div className="w-16" />
      </div>

      <div className="space-y-8 text-[18px]">
        <section>
          <p className="text-xl font-black underline">To be filled by the student</p>
          <div className="mt-4 grid grid-cols-[1fr_140px] gap-6">
            <div className="grid grid-cols-2 gap-x-8 gap-y-4">
              <div className="flex flex-col gap-1">
                <span className="font-black">Name of student:</span>
                <div className={readOnlyLineClassName()}>
                  <input
                    value={studentName}
                    readOnly={readOnly}
                    disabled={readOnly}
                    className={readOnlyInputClassName('leading-none')}
                  />
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <span className="font-black">ID.No:</span>
                <div className={readOnlyLineClassName()}>
                  <input
                    value={studentIdNumber}
                    readOnly={readOnly}
                    disabled={readOnly}
                    className={readOnlyInputClassName('leading-none')}
                  />
                </div>
              </div>
              <div>
                <span className="font-black">Department/ program:</span>{' '}
                <input
                  value={studentDepartment}
                  readOnly={readOnly}
                  disabled={readOnly}
                  className={readOnlyInputClassName('underline')}
                />
              </div>
              <div>
                <span className="font-black">Year/ Semester:</span>{' '}
                <input
                  value={studentYear}
                  readOnly={readOnly}
                  disabled={readOnly}
                  className={readOnlyInputClassName('underline')}
                />
              </div>
              <div className="flex flex-col gap-1">
                <span className="font-black">Phone Number:</span>
                <div className={readOnlyLineClassName()}>
                  <input
                    value={studentPhone}
                    readOnly={readOnly}
                    disabled={readOnly}
                    className={readOnlyInputClassName('leading-none')}
                  />
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <span className="font-black">Email:</span>
                <div className={readOnlyLineClassName()}>
                  <input
                    value={studentEmail}
                    readOnly={readOnly}
                    disabled={readOnly}
                    className={readOnlyInputClassName('leading-none')}
                  />
                </div>
              </div>
              <div className="col-span-2 border-b border-black pb-1">
                <span className="font-black">Signature:</span>{' '}
                {studentSignature ? (
                  <img
                    src={resolveMediaUrl(studentSignature)}
                    alt="Student Signature"
                    className="pointer-events-none mt-1 h-12 max-h-12 w-full max-w-[18rem] object-contain object-left"
                    style={{ backgroundColor: 'transparent' }}
                  />
                ) : (
                  <span className="italic text-slate-600">(Waiting for student signature)</span>
                )}
              </div>
            </div>
            <div className="h-36 w-full overflow-hidden rounded-lg border border-black bg-white">
              {studentPhoto ? (
                <img src={resolveMediaUrl(studentPhoto)} alt="Student" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-[10px] font-black text-black/60">Student Photo</div>
              )}
            </div>
          </div>
        </section>

        <section>
          <p className="text-xl font-black underline">To be filled by the company</p>
          <div className="mt-4 space-y-4">
            <div className="border-b border-black pb-1">
              <span className="font-black">Company name:</span>{' '}
              <input
                value={companyName}
                readOnly={readOnly}
                disabled={readOnly}
                className="w-[70%] bg-transparent px-1 font-semibold text-black outline-none disabled:cursor-default disabled:opacity-100"
              />
            </div>
            <div className="flex flex-col gap-1">
              <span className="font-black">Place/town:</span>
              <div className={readOnlyLineClassName()}>
                <input
                  value={placeTown}
                  readOnly={readOnly}
                  disabled={readOnly}
                  className={readOnlyInputClassName('pb-1 pt-1')}
                />
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <span className="font-black">Contact person:</span>
              <div className={readOnlyLineClassName()}>
                <input
                  value={contactPerson}
                  readOnly={readOnly}
                  disabled={readOnly}
                  className={readOnlyInputClassName('pb-1 pt-1')}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-x-8">
              <div className="border-b border-black pb-1">
                <span className="font-black">Phone Number:</span>{' '}
                <input
                  value={companyPhone}
                  readOnly={readOnly}
                  disabled={readOnly}
                  className="w-[58%] bg-transparent px-1 font-semibold text-black outline-none disabled:cursor-default disabled:opacity-100"
                />
              </div>
              <div className="border-b border-black pb-1">
                <span className="font-black">Email:</span>{' '}
                <input
                  value={companyEmail}
                  readOnly={readOnly}
                  disabled={readOnly}
                  className="w-[74%] bg-transparent px-1 font-semibold text-black outline-none disabled:cursor-default disabled:opacity-100"
                />
              </div>
            </div>
          </div>
        </section>

        <section className="space-y-4 leading-relaxed">
          <p>
            I, on behalf of {companyName || '___________________'} (Company Name), confirm the Acceptance of the aforementioned student as an intern for the designated amount of time (i.e. for at least 200 hours for Two- months).
          </p>
          <p>
            After completing this form, please hand it over to the student or submit it to the University of Gondar official channel.
          </p>
        </section>

        <section className="grid grid-cols-3 gap-8">
          <div>
            <p className="font-black">Name:</p>
            <div className="mt-2 border-b border-black pb-1">
              <input
                value={representativeName}
                readOnly={readOnly}
                disabled={readOnly}
                className="w-full bg-transparent font-semibold text-black outline-none disabled:cursor-default disabled:opacity-100"
              />
            </div>
          </div>
          <div>
            <p className="font-black">Signature:</p>
            <div className="mt-2 border-b border-black pb-1">
              {representativeSignature ? (
                <img src={resolveMediaUrl(representativeSignature)} alt="Digital Signature" className="h-12 w-full object-contain object-left" style={{ backgroundColor: 'transparent' }} />
              ) : (
                <span className="font-semibold">____________________</span>
              )}
            </div>
          </div>
          <div>
            <p className="font-black">Date:</p>
            <div className="mt-2 border-b border-black pb-1">
              <input
                value={representativeDate}
                readOnly={readOnly}
                disabled={readOnly}
                className="w-full bg-transparent font-semibold text-black outline-none disabled:cursor-default disabled:opacity-100"
                placeholder={new Date().toLocaleDateString()}
              />
            </div>
          </div>
        </section>
      </div>
    </section>
  );
}

export function EvaluationForm({ data, readOnly = false }) {
  const studentName = data?.studentName || data?.fullName || data?.name || '';
  const studentIdNumber = data?.studentIdNumber || data?.idNumber || data?.id_number || '';
  const studentDepartment = data?.studentDepartment || data?.department || '';
  const studentPhone = data?.studentPhone || data?.phone || '';
  const studentEmail = data?.studentEmail || data?.email || '';
  const supervisorName = data?.supervisorName || data?.supervisor?.name || '';
  const companyName = data?.companyName || '';
  const contactPerson = data?.contactPerson || '';
  const companyLogo = data?.companyLogo || data?.logoUrl || data?.logo || '';
  const companySignature = data?.companySignature || data?.signatureUrl || data?.digitalSignature || '';
  const criteriaScores = data?.criteriaScores || {};
  const totalScore = Number.isFinite(Number(data?.score)) ? Number(data.score) : Object.values(criteriaScores).reduce((sum, value) => sum + (Number(value) || 0), 0);
  const academicHeader = data?.academicHeader || {};

  const renderScoreInput = (criterion) => (
    <div key={criterion.id} className="flex border-b border-black">
      <div className="w-3/4 border-r border-black p-2 pl-4 font-semibold">{criterion.label}</div>
      <div className="flex w-1/4 items-center justify-center p-1">
        <input
          type="number"
          min="0"
          max={criterion.max}
          value={criteriaScores[criterion.id] ?? ''}
          readOnly={readOnly}
          disabled={readOnly}
          className="w-12 border-b border-black bg-transparent text-center font-black text-black outline-none disabled:cursor-default disabled:opacity-100"
        />
        <span className="ml-1 font-semibold">/{criterion.max}</span>
      </div>
    </div>
  );

  return (
    <section className="border-2 border-black bg-white p-10 font-serif text-black shadow-xl print:shadow-none print:border-none">
      <div className="mb-10 border-b-2 border-black pb-6 text-center">
        <h1 className="text-2xl font-black uppercase tracking-wider">UNIVERSITY OF GONDAR</h1>
        {academicHeader.hasAcademicInfo ? (
          <h2 className="mt-2 text-xl font-black">{academicHeader.college}, {academicHeader.department}</h2>
        ) : (
          <h2 className="mt-2 text-xl font-black">{academicHeader.fallback || 'University of Gondar'}</h2>
        )}
        <h3 className="mt-4 text-lg font-black uppercase underline">OFFICIAL INTERNSHIP EVALUATION FORM</h3>
      </div>

      <div className="mb-8 font-sans text-black">
        <h4 className="mb-4 text-sm font-black uppercase underline">Student Information</h4>
        <div className="grid grid-cols-2 gap-x-8 gap-y-4 text-sm font-semibold">
          <div className="border-b border-black pb-1"><span className="font-black">Name:</span> {valueOrDash(studentName)}</div>
          <div className="border-b border-black pb-1"><span className="font-black">ID.No:</span> {valueOrDash(studentIdNumber)}</div>
          <div className="border-b border-black pb-1"><span className="font-black">Department:</span> {valueOrDash(studentDepartment)}</div>
          <div className="border-b border-black pb-1"><span className="font-black">Phone:</span> {valueOrDash(studentPhone)}</div>
          <div className="border-b border-black pb-1"><span className="font-black">Email:</span> {valueOrDash(studentEmail)}</div>
          <div className="border-b border-black pb-1"><span className="font-black">Supervisor:</span> {valueOrDash(supervisorName)}</div>
        </div>
      </div>

      <div className="mb-8 font-sans text-black">
        <div className="mb-4 flex items-start justify-between">
          <h4 className="mt-2 text-sm font-black uppercase underline">To be filled by the company</h4>
          <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-lg border border-black bg-white text-xs font-bold text-black">
            {companyLogo ? <img src={resolveMediaUrl(companyLogo)} alt="Company Logo" className="h-full w-full object-contain" /> : 'Company Logo'}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-x-8 gap-y-4 text-sm font-semibold">
          <div className="border-b border-black pb-1"><span className="font-black">Company Name:</span> {valueOrDash(companyName)}</div>
          <div className="border-b border-black pb-1"><span className="font-black">Contact Person:</span> {valueOrDash(contactPerson)}</div>
        </div>
      </div>

      <div className="mb-8 border border-black font-sans text-sm text-black">
        <div className="flex border-b border-black bg-white font-black">
          <div className="w-3/4 border-r border-black p-2">Criterion</div>
          <div className="w-1/4 p-2 text-center">Max points</div>
        </div>

        <div className="border-b border-black bg-white p-2 font-black italic">Group 1: Professional Qualifications (42%)</div>
        {CRITERIA.group1.map(renderScoreInput)}

        <div className="border-b border-t-2 border-t-black border-black bg-white p-2 font-black italic">Group 2: Technical Skills (28%)</div>
        {CRITERIA.group2.map(renderScoreInput)}

        <div className="border-b border-t-2 border-t-black border-black bg-white p-2 font-black italic">Group 3: Interpersonal and Teamwork Skills (30%)</div>
        {CRITERIA.group3.map(renderScoreInput)}

        <div className="flex border-t-2 border-black bg-white font-black">
          <div className="w-3/4 border-r border-black p-2 text-right uppercase tracking-wider">Total Result (100%)</div>
          <div className="w-1/4 p-2 text-center text-3xl">{totalScore}</div>
        </div>
      </div>

      <div className="space-y-8 font-sans text-sm text-black">
        <div className="flex items-end justify-between">
          <div>
            <p className="mb-6 font-black">Supervisor Name and Signature</p>
            <div className="w-64 border-b border-black pb-1">
              {companySignature ? (
                <img src={resolveMediaUrl(companySignature)} alt="Digital Signature" className="h-12 w-full object-contain object-left" style={{ backgroundColor: 'transparent' }} />
              ) : (
                <div className="text-center italic">__________________</div>
              )}
            </div>
          </div>
          <div>
            <p className="mb-6 font-black">Date of evaluation</p>
            <div className="w-48 border-b border-black pb-1 text-center font-black">{data?.evaluationDate || new Date().toLocaleDateString()}</div>
          </div>
        </div>

        <div className="pt-8 text-center">
          <p className="text-lg font-black">Thank You</p>
          <p className="mt-4 text-2xl font-black">{academicHeader.department || toTitleCase(studentDepartment) || 'Department'}</p>
          <p className="text-xl font-bold">University of Gondar</p>
        </div>
      </div>
    </section>
  );
}

export default function OfficialEvaluationForm({ acceptanceData, evaluationData, readOnly = true, className = '' }) {
  return (
    <div className={['flex w-[794px] max-w-full flex-col gap-6 bg-white', className].join(' ')} style={{ lineHeight: 1.5 }}>
      <AcceptanceForm data={acceptanceData} readOnly={readOnly} />
      <div className="break-before-page page-break-before-always" style={{ breakBefore: 'page', pageBreakBefore: 'always' }} />
      <EvaluationForm data={evaluationData} readOnly={readOnly} />
    </div>
  );
}
