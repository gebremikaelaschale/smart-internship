import { useNavigate, useParams } from 'react-router-dom';
import React, { useMemo, useState, useEffect } from 'react';
import Select from 'react-select';
import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import { employerAPI } from '../employerAPI';

const LOCATION_DATA = {
  "Amhara": {
    "Central Gondar": ["Gondar City", "Maksegnit", "Aykel", "Chuahit", "Kolla Diba"],
    "South Gondar": ["Debre Tabor", "Woreta", "Addis Zemen", "Ebinat", "Nefas Mewcha"],
    "North Gondar": ["Debark", "Dabat", "Tekel Dingay"],
    "West Gondar": ["Metema", "Midre Genet", "Abderafi"],
    "Bahir Dar (Special Zone)": ["Bahir Dar", "Tis Abay", "Meshenti"],
    "West Gojjam": ["Finote Selam", "Bure", "Dangila", "Merawi"],
    "East Gojjam": ["Debre Markos", "Bichena", "Dejen", "Mota"],
    "North Wollo": ["Woldia", "Lalibela", "Kobo", "Mersa"],
    "South Wollo": ["Dessie", "Kombolcha", "Haik", "Kutaber"],
    "North Shewa": ["Debre Berhan", "Shewa Robit", "Ataye", "Mehal Meda"]
  },
  "Oromia": {
    "East Shewa": ["Adama (Nazret)", "Bishoftu (Debre Zeyit)", "Modjo", "Batu (Zeway)", "Metehara"],
    "Jimma": ["Jimma City", "Agaro", "Limmu Genet", "Gera"],
    "West Shewa": ["Ambo", "Holeta", "Bako", "Guder"],
    "South West Shewa": ["Woliso", "Tullu Bolo", "Kersa"],
    "Arsi": ["Asella", "Bokoji", "Huruta", "Sagure"]
  },
  "Addis Ababa": {
    "Bole": ["Bole Arabsa", "Ayat", "Gerji", "Goro", "Bole Michael"],
    "Yeka": ["Megenagna", "Kotebe", "Ayat Tafo", "CMC", "Ferensay Legasion"],
    "Arada": ["Piazza", "4 Kilo", "Aware", "Eri Bekentu"],
    "Kirkos": ["Kasanchis", "Meskel Square", "Gotera", "Sarbet"]
  },
  "South Ethiopia": {
    "Wolayita": ["Sodo", "Areka", "Boditi", "Gununo"],
    "Gamo": ["Arba Minch", "Chencha", "Birbir"]
  },
  "Tigray": {
    "Mekelle (Special Zone)": ["Mekelle City", "Quiha", "Aynalem"],
    "Eastern": ["Adigrat", "Wukro", "Edaga Hamus"],
    "Central": ["Axum", "Adwa", "Abyi Addi"]
  },
  "Sidama": {
    "Hawassa City": ["Tabor", "Mehal Ketema", "Hayk Dar", "Tula"],
    "Central Sidama": ["Yirgalem", "Leku", "Aleta Wendo"]
  },
  "Dire Dawa": {
    "Dire Dawa City": ["Kezira", "Megala", "Dechatu", "Sabian"]
  }
};

const LOCATION_OPTIONS = Object.entries(LOCATION_DATA).map(([region, zones]) => ({
  label: region,
  options: Object.entries(zones).map(([zone, towns]) => ({
    label: zone,
    parentRegion: region,
    options: towns.map(town => ({ value: `${town}, ${zone}, ${region}`, label: town }))
  }))
}));

const BATCH_OPTIONS = [
  { value: '3rd Year', label: '3rd Year' },
  { value: '4th Year', label: '4th Year' },
  { value: '5th Year / Graduating', label: '5th Year / Graduating' },
  { value: 'Post-Graduate', label: 'Post-Graduate' }
];

const MODALITY_OPTIONS = [
  { value: 'On-site', label: 'On-site' },
  { value: 'Remote', label: 'Remote' },
  { value: 'Hybrid', label: 'Hybrid' }
];

const COMPENSATION_OPTIONS = [
  { value: 'Paid', label: 'Paid (Monthly Salary)' },
  { value: 'Allowance', label: 'Unpaid - Covers Allowance (Transport/Lunch)' },
  { value: 'Unpaid', label: 'Unpaid (Fully Volunteer)' }
];

const DEPARTMENT_OPTIONS = [
  {
    label: "Institute of Technology / Engineering",
    options: [
      { value: "Software Engineering", label: "Software Engineering" },
      { value: "Computer Science", label: "Computer Science" },
      { value: "Information Systems", label: "Information Systems" },
      { value: "Information Technology", label: "Information Technology" },
      { value: "Electrical & Computer Engineering", label: "Electrical & Computer Engineering" },
      { value: "Mechanical Engineering", label: "Mechanical Engineering" },
      { value: "Civil Engineering", label: "Civil Engineering" },
      { value: "Architecture", label: "Architecture" },
      { value: "Chemical Engineering", label: "Chemical Engineering" },
      { value: "Biomedical Engineering", label: "Biomedical Engineering" }
    ]
  },
  {
    label: "College of Business & Economics (CBE)",
    options: [
      { value: "Accounting and Finance", label: "Accounting and Finance" },
      { value: "Economics", label: "Economics" },
      { value: "Management", label: "Management" },
      { value: "Marketing Management", label: "Marketing Management" },
      { value: "Public Administration", label: "Public Administration" },
      { value: "Tourism and Hotel Management", label: "Tourism and Hotel Management" }
    ]
  },
  {
    label: "College of Natural & Computational Sciences",
    options: [
      { value: "Mathematics", label: "Mathematics" },
      { value: "Physics", label: "Physics" },
      { value: "Chemistry", label: "Chemistry" },
      { value: "Biology", label: "Biology" },
      { value: "Statistics", label: "Statistics" },
      { value: "Sport Science", label: "Sport Science" }
    ]
  },
  {
    label: "College of Health & Medical Sciences",
    options: [
      { value: "Medicine (MD)", label: "Medicine (MD)" },
      { value: "Nursing", label: "Nursing" },
      { value: "Pharmacy", label: "Pharmacy" },
      { value: "Public Health", label: "Public Health" },
      { value: "Medical Laboratory Sciences", label: "Medical Laboratory Sciences" },
      { value: "Midwifery", label: "Midwifery" },
      { value: "Environmental Health", label: "Environmental Health" }
    ]
  },
  {
    label: "College of Agriculture & Environmental Sciences",
    options: [
      { value: "Plant Science", label: "Plant Science" },
      { value: "Animal Science", label: "Animal Science" },
      { value: "Natural Resource Management", label: "Natural Resource Management" },
      { value: "Agricultural Economics", label: "Agricultural Economics" },
      { value: "Agribusiness and Value Chain Management", label: "Agribusiness and Value Chain Management" }
    ]
  },
  {
    label: "College of Social Sciences & Humanities",
    options: [
      { value: "English Language and Literature", label: "English Language and Literature" },
      { value: "Geography and Environmental Studies", label: "Geography and Environmental Studies" },
      { value: "History and Heritage Management", label: "History and Heritage Management" },
      { value: "Sociology", label: "Sociology" },
      { value: "Psychology", label: "Psychology" },
      { value: "Journalism and Communication", label: "Journalism and Communication" }
    ]
  },
  {
    label: "College of Law & Governance",
    options: [
      { value: "Law", label: "Law" },
      { value: "Political Science and International Relations", label: "Political Science and International Relations" },
      { value: "Civics and Ethical Studies", label: "Civics and Ethical Studies" }
    ]
  }
];

const INITIAL_FORM = {
  title: '',
  description: '',
  skillInput: '',
  skills: [],
  startDate: '',
  endDate: '',
  slots: '',
  location: 'Addis Ababa',
  selectedCollege: '', 
  expandedColleges: [], 
  expandedRegions: [], 
  expandedZones: [], // Track expanded zones in nested location tree
  targetDepartments: [],
  targetBatch: '4th Year',
  workModality: 'On-site',
  compensationType: 'Unpaid'
};

export default function PostInternship() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);

  const [form, setForm] = useState({
    title: '',
    duration: '',
    startDate: '',
    endDate: '',
    deadline: '',
    location: 'Addis Ababa, Kirkos, Addis Ababa',
    targetDepartments: [],
    targetBatch: '5th Year / Graduating',
    workModality: 'On-site',
    compensationType: 'Paid',
    minCgpa: '',
    interviewRequired: false,
    slots: 1,
    skills: [],
    skillInput: '',
    description: '',
    expandedColleges: [], 
    expandedRegions: [], 
    expandedZones: []
  });

  const [submitting, setSubmitting] = useState(false);
  const [loadingData, setLoadingData] = useState(isEdit);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (!isEdit) return;

    const loadInternship = async () => {
      try {
        setLoadingData(true);
        const { data } = await employerAPI.getInternship(id);
        
        setForm({
          title: data.title || '',
          duration: data.duration || '',
          startDate: data.startDate ? new Date(data.startDate).toISOString().split('T')[0] : '',
          endDate: data.endDate ? new Date(data.endDate).toISOString().split('T')[0] : '',
          deadline: data.deadline ? new Date(data.deadline).toISOString().split('T')[0] : '',
          location: data.location || 'Addis Ababa, Kirkos, Addis Ababa',
          targetDepartments: Array.isArray(data.targetDepartments) ? data.targetDepartments : [],
          targetBatch: data.targetBatch || '5th Year / Graduating',
          workModality: data.workModality || 'On-site',
          compensationType: data.compensationType || 'Paid',
          minCgpa: data.minCgpa || '',
          interviewRequired: data.interviewRequired === true,
          slots: data.studentsNeeded || 1,
          skills: Array.isArray(data.requiredSkills) ? data.requiredSkills : [],
          skillInput: '',
          description: data.description || '',
          expandedColleges: [], 
          expandedRegions: [], 
          expandedZones: []
        });
      } catch (err) {
        const msg = err.response?.data?.message || err.message || 'Failed to load internship details.';
        setError(msg);
      } finally {
        setLoadingData(false);
      }
    };

    loadInternship();
  }, [id, isEdit]);

  const parsedSkills = useMemo(
    () => form.skills,
    [form.skills]
  );

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const addSkill = () => {
    const nextSkill = form.skillInput.trim();
    if (!nextSkill) {
      return;
    }

    const exists = form.skills.some((skill) => skill.toLowerCase() === nextSkill.toLowerCase());
    if (exists) {
      setForm((prev) => ({ ...prev, skillInput: '' }));
      return;
    }

    setForm((prev) => ({
      ...prev,
      skills: [...prev.skills, nextSkill],
      skillInput: ''
    }));
  };

  const handleSkillsKeyDown = (event) => {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      addSkill();
    }
  };

  const removeSkill = (skillToRemove) => {
    setForm((prev) => ({
      ...prev,
      skills: prev.skills.filter((skill) => skill !== skillToRemove)
    }));
  };

  const getDuration = () => {
    if (!form.startDate || !form.endDate) return '';
    const start = new Date(form.startDate);
    const end = new Date(form.endDate);
    const diffMs = end - start;
    if (diffMs < 0) return '';
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    const months = Math.round(diffDays / 30);
    if (months >= 1) return `${months} month${months > 1 ? 's' : ''}`;
    const weeks = Math.round(diffDays / 7);
    return `${weeks} week${weeks > 1 ? 's' : ''}`;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (form.skills.length === 0) {
      setError('Please add at least one required skill.');
      return;
    }

    try {
      setSubmitting(true);
      const payload = {
        title: form.title,
        duration: getDuration() || form.duration,
        startDate: form.startDate,
        endDate: form.endDate,
        deadline: form.deadline || form.endDate,
        location: form.location,
        targetDepartments: form.targetDepartments,
        targetBatch: form.targetBatch,
        workModality: form.workModality,
        compensationType: form.compensationType,
        minCgpa: Number(form.minCgpa) || 0,
        interviewRequired: form.interviewRequired,
        studentsNeeded: Number(form.slots),
        requiredSkills: form.skills,
        description: form.description,
        programType: 'Internship Program',
        trainingFocus: true
      };

      if (isEdit) {
        await employerAPI.updateInternship(id, payload);
        setSuccess('Internship updated successfully! Redirecting...');
      } else {
        await employerAPI.createInternship(payload);
        setSuccess('Internship posted successfully! Redirecting...');
      }

      setTimeout(() => navigate('/employer/my-programs'), 2000);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to submit internship.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingData) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-slate-500 italic">Loading internship details...</p>
      </div>
    );
  }

  return (
    <Card 
      title={isEdit ? "Edit Internship Program" : "Post Internship"} 
      description={isEdit ? "Update your internship requirements and details." : "Create and publish an internship opportunity for students."}>
      <form className="grid gap-4 md:grid-cols-2" onSubmit={handleSubmit}>
        <Input
          label="Title"
          name="title"
          value={form.title}
          onChange={handleChange}
          placeholder="Backend Engineering Internship"
          required
        />

        <Input
          label="Start Date"
          name="startDate"
          type="date"
          value={form.startDate}
          onChange={handleChange}
          required
        />
        <div className="flex flex-col gap-2">
          <Input
            label="End Date"
            name="endDate"
            type="date"
            value={form.endDate}
            onChange={handleChange}
            required
          />
          {form.startDate && form.endDate && (
            <div className="px-1">
              <p className="text-xs font-semibold text-emerald-600 animate-in fade-in slide-in-from-left-1">
                Calculated Duration: {getDuration() || 'Invalid range'}
              </p>
            </div>
          )}
        </div>

        <Input
          label="Application Deadline"
          name="deadline"
          type="date"
          value={form.deadline}
          onChange={handleChange}
          description="Last day for students to apply."
          required
        />

        <div className="md:col-span-2 grid gap-4 md:grid-cols-2 p-6 rounded-3xl border border-emerald-100 bg-emerald-50/30">
          <div className="md:col-span-2">
            <h3 className="text-lg font-bold text-emerald-900">University Placement Settings</h3>
            <p className="text-sm text-emerald-700/80">Tailor this internship to match the right students.</p>
          </div>

          {/* Unified Hierarchical Target Department(s) Select */}
          <div className="md:col-span-2">
            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-700">Target Department(s)</span>
              <Select
                isMulti
                options={DEPARTMENT_OPTIONS}
                value={DEPARTMENT_OPTIONS.flatMap(g => g.options).filter(opt => form.targetDepartments.includes(opt.value))}
                onChange={(opts) => handleChange({ target: { name: 'targetDepartments', value: opts ? opts.map(o => o.value) : [] } })}
                className="text-sm"
                placeholder="Search or select departments..."
                closeMenuOnSelect={false}
                hideSelectedOptions={false}
                components={{
                  Group: (props) => {
                    const isExpanded = form.expandedColleges.includes(props.label);
                    return (
                      <div className="border-b border-slate-50">
                        {props.Heading({ ...props.headingProps, children: props.label, data: props.data })}
                        {isExpanded && (
                          <div className="bg-white py-1 animate-in slide-in-from-top-1 duration-200">
                            {props.children}
                          </div>
                        )}
                      </div>
                    );
                  },
                  GroupHeading: (props) => {
                    const isExpanded = form.expandedColleges.includes(props.children);
                    const groupValues = props.data.options.map(o => o.value);
                    const allSelected = groupValues.every(v => form.targetDepartments.includes(v));

                    // Generate a unique color based on the college name
                    const colors = [
                      'text-emerald-600 bg-emerald-50', 
                      'text-sky-600 bg-sky-50', 
                      'text-violet-600 bg-violet-50', 
                      'text-rose-600 bg-rose-50', 
                      'text-amber-600 bg-amber-50',
                      'text-indigo-600 bg-indigo-50',
                      'text-cyan-600 bg-cyan-50'
                    ];
                    const colorClass = colors[props.data.options.length % colors.length] || colors[0];

                    const toggleExpand = (e) => {
                      e.stopPropagation();
                      setForm(prev => ({
                        ...prev,
                        expandedColleges: isExpanded 
                          ? prev.expandedColleges.filter(c => c !== props.children)
                          : [...prev.expandedColleges, props.children]
                      }));
                    };

                    const handleSelectAll = (e) => {
                      e.stopPropagation();
                      let nextValues;
                      if (allSelected) {
                        nextValues = form.targetDepartments.filter(v => !groupValues.includes(v));
                      } else {
                        nextValues = [...new Set([...form.targetDepartments, ...groupValues])];
                      }
                      handleChange({ target: { name: 'targetDepartments', value: nextValues } });
                    };

                    return (
                      <div className="group flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-slate-50 transition-all border-l-4 border-transparent hover:border-emerald-400">
                        <div className="flex items-center gap-3 flex-1" onClick={toggleExpand}>
                          <span className={`text-slate-300 transition-transform duration-300 ${isExpanded ? 'rotate-90 text-emerald-500' : ''}`}>
                            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                          </span>
                          <span className={`text-[13px] font-black uppercase tracking-[0.1em] transition-colors duration-200 group-hover:text-sky-600 ${isExpanded ? 'text-emerald-700' : 'text-slate-600'}`} style={{ fontFamily: "'Times New Roman', Times, serif" }}>
                            {props.children}
                          </span>
                        </div>
                        <div 
                          onClick={handleSelectAll}
                          className={`h-6 w-6 rounded-lg flex items-center justify-center transition-all border-2 ${
                            allSelected 
                              ? 'bg-emerald-500 border-emerald-500 text-white shadow-lg shadow-emerald-100' 
                              : 'bg-white border-slate-200 text-slate-300 hover:border-emerald-400 hover:text-emerald-500'
                          }`}
                        >
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={4}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                        </div>
                      </div>
                    );
                  }
                }}
                styles={{
                  container: (base) => ({ ...base, fontFamily: "'Times New Roman', Times, serif" }),
                  control: (base) => ({ ...base, borderRadius: '1.25rem', borderColor: '#e2e8f0', padding: '8px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.05)', backgroundColor: '#fff' }),
                  menu: (base) => ({ ...base, borderRadius: '1.5rem', overflow: 'hidden', border: '1px solid #f1f5f9', boxShadow: '0 25px 50px -12px rgb(0 0 0 / 0.15)', marginTop: '8px' }),
                  group: (base) => ({ ...base, padding: 0 }),
                  groupHeading: (base) => ({ ...base, margin: 0, padding: 0 }),
                  option: (base, state) => {
                    return {
                      ...base,
                      paddingLeft: '3.5rem',
                      fontSize: '1rem',
                      fontWeight: '700',
                      backgroundColor: state.isSelected ? '#10b981' : state.isFocused ? '#f8fafc' : 'transparent',
                      color: state.isSelected ? 'white' : state.isFocused ? '#0ea5e9' : '#475569',
                      transition: 'all 0.2s ease',
                      borderLeft: state.isFocused ? '4px solid #0ea5e9' : '4px solid transparent',
                      ':active': { backgroundColor: '#059669' }
                    };
                  },
                  multiValue: (base) => ({ ...base, backgroundColor: '#f0fdf4', borderRadius: '10px', border: '1px solid #dcfce7', padding: '2px 6px' }),
                  multiValueLabel: (base) => ({ ...base, color: '#166534', fontWeight: '900', fontSize: '11px', textTransform: 'uppercase', tracking: '0.05em' }),
                  multiValueRemove: (base) => ({ ...base, color: '#166534', borderRadius: '6px', marginLeft: '4px', ':hover': { backgroundColor: '#bbf7d0', color: '#166534' } })
                }}
              />
            </label>
          </div>

          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-700">Location</span>
            <Select
              options={LOCATION_OPTIONS}
              value={LOCATION_OPTIONS.flatMap(r => r.options).flatMap(z => z.options).find(opt => opt.value === form.location)}
              onChange={(opt) => handleChange({ target: { name: 'location', value: opt ? opt.value : '' } })}
              className="text-sm"
              placeholder="Select Town / City..."
              components={{
                GroupHeading: (props) => {
                  // We handle the Heading inside the Group component for better control over expansion
                  return null; 
                },
                Group: (props) => {
                  const isExpanded = form.expandedRegions.includes(props.label);
                  const toggleExpand = (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setForm(prev => ({
                      ...prev,
                      expandedRegions: isExpanded 
                        ? prev.expandedRegions.filter(c => c !== props.label)
                        : [...prev.expandedRegions, props.label]
                    }));
                  };

                  return (
                    <div className="border-b border-slate-100">
                      {/* Region Header (Level 1) */}
                      <div 
                        className={`group flex items-center justify-between px-4 py-3.5 cursor-pointer hover:bg-indigo-50/50 transition-all border-l-4 ${isExpanded ? 'border-indigo-500 bg-indigo-50/30' : 'border-transparent'}`}
                        onClick={toggleExpand}
                      >
                        <div className="flex items-center gap-3 flex-1">
                          <span className={`transition-transform duration-300 ${isExpanded ? 'rotate-90 text-indigo-600' : 'text-slate-300'}`}>
                            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                          </span>
                          <span className={`text-[14px] font-black uppercase tracking-[0.12em] transition-colors duration-200 ${isExpanded ? 'text-indigo-800' : 'text-slate-600 group-hover:text-indigo-600'}`} style={{ fontFamily: "'Times New Roman', Times, serif" }}>
                            {props.label}
                          </span>
                        </div>
                      </div>

                      {/* Zones (Level 2) */}
                      {isExpanded && (
                        <div className="animate-in slide-in-from-top-1 duration-200">
                          {props.children}
                        </div>
                      )}
                    </div>
                  );
                },
                Option: (props) => {
                  const { data } = props;
                  const isZone = data.options !== undefined; // Level 2
                  
                  if (isZone) {
                    const isExpanded = form.expandedZones.includes(data.label);
                    const toggleExpand = (e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setForm(prev => ({
                        ...prev,
                        expandedZones: isExpanded 
                          ? prev.expandedZones.filter(z => z !== data.label)
                          : [...prev.expandedZones, data.label]
                      }));
                    };

                    return (
                      <div className="ml-4 border-l border-slate-200">
                        <div className={`flex items-center gap-2 px-3 py-2.5 cursor-pointer hover:bg-sky-50 transition-all ${isExpanded ? 'bg-sky-50' : ''}`} onClick={toggleExpand}>
                          <span className={`transition-transform duration-200 ${isExpanded ? 'rotate-90 text-sky-600' : 'text-slate-300'}`}>
                            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={4}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                          </span>
                          <span className={`text-[12.5px] font-bold uppercase tracking-wide transition-colors ${isExpanded ? 'text-sky-700' : 'text-slate-500 group-hover:text-sky-600'}`}>
                            {data.label}
                          </span>
                        </div>
                        {isExpanded && (
                          <div className="animate-in slide-in-from-left-1 duration-200">
                            {data.options.map(townOpt => (
                              <div
                                key={townOpt.value}
                                className={`pl-10 py-2.5 text-[1rem] font-bold cursor-pointer transition-all border-l-4 border-transparent hover:border-emerald-500 hover:bg-emerald-50/50 hover:text-emerald-700 ${form.location === townOpt.value ? 'bg-emerald-50 border-emerald-500 text-emerald-700' : 'text-slate-600'}`}
                                onClick={() => {
                                  handleChange({ target: { name: 'location', value: townOpt.value } });
                                  props.selectOption(townOpt);
                                }}
                              >
                                {townOpt.label}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  }

                  return null; // Should not reach here with current data structure
                }
              }}
              styles={{
                container: (base) => ({ ...base, fontFamily: "'Times New Roman', Times, serif" }),
                control: (base) => ({ ...base, borderRadius: '1.25rem', borderColor: '#e2e8f0', padding: '8px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.05)', backgroundColor: '#fff' }),
                menu: (base) => ({ ...base, borderRadius: '1.5rem', overflow: 'hidden', border: '1px solid #f1f5f9', boxShadow: '0 25px 50px -12px rgb(0 0 0 / 0.15)', marginTop: '8px' }),
                group: (base) => ({ ...base, padding: 0 }),
                groupHeading: (base) => ({ ...base, margin: 0, padding: 0 })
              }}
            />
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-700">Target Batch / Year</span>
            <Select
              options={BATCH_OPTIONS}
              value={BATCH_OPTIONS.find(opt => opt.value === form.targetBatch)}
              onChange={(opt) => handleChange({ target: { name: 'targetBatch', value: opt.value } })}
              className="text-sm"
              styles={{
                control: (base) => ({ ...base, borderRadius: '0.75rem', borderColor: '#cbd5e1' })
              }}
            />
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-700">Work Modality</span>
            <Select
              options={MODALITY_OPTIONS}
              value={MODALITY_OPTIONS.find(opt => opt.value === form.workModality)}
              onChange={(opt) => handleChange({ target: { name: 'workModality', value: opt.value } })}
              className="text-sm"
              styles={{
                control: (base) => ({ ...base, borderRadius: '0.75rem', borderColor: '#cbd5e1' })
              }}
            />
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-700">Compensation</span>
            <Select
              options={COMPENSATION_OPTIONS}
              value={COMPENSATION_OPTIONS.find(opt => opt.value === form.compensationType)}
              onChange={(opt) => handleChange({ target: { name: 'compensationType', value: opt.value } })}
              className="text-sm"
              styles={{
                control: (base) => ({ ...base, borderRadius: '0.75rem', borderColor: '#cbd5e1' })
              }}
            />
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-700">Minimum CGPA (Optional)</span>
            <input
              type="number"
              step="0.01"
              min="0"
              max="4"
              name="minCgpa"
              value={form.minCgpa}
              onChange={handleChange}
              placeholder="e.g. 2.5 (Leave blank if not required)"
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm outline-none transition focus:border-emerald-400"
            />
          </label>

          <div className="md:col-span-2 flex items-center gap-3 p-2">
            <input
              type="checkbox"
              id="interviewRequired"
              checked={form.interviewRequired}
              onChange={(e) => handleChange({ target: { name: 'interviewRequired', value: e.target.checked } })}
              className="h-5 w-5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
            />
            <label htmlFor="interviewRequired" className="text-sm font-semibold text-slate-700 cursor-pointer">
              Interview Required? <span className="font-normal text-slate-500">(Check if you want to screen students before placement)</span>
            </label>
          </div>
        </div>
        <Input
          label="Slots (Number of Students Required)"
          name="slots"
          type="number"
          min="1"
          value={form.slots}
          onChange={handleChange}
          placeholder="e.g. 10"
          required
        />

        <div className="md:col-span-2">
          <label className="block space-y-2">
            <span className="text-sm font-medium text-slate-700">Skills (tags)</span>
            <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-100">
              <div className="mb-2 flex flex-wrap gap-2">
                {form.skills.map((skill) => (
                  <button
                    key={skill}
                    type="button"
                    onClick={() => removeSkill(skill)}
                    className="rounded-full bg-brand-100 px-3 py-1 text-xs font-medium text-brand-700 transition hover:bg-brand-200"
                  >
                    {skill} x
                  </button>
                ))}
              </div>
              <input
                name="skillInput"
                value={form.skillInput}
                onChange={handleChange}
                onKeyDown={handleSkillsKeyDown}
                onBlur={addSkill}
                placeholder="Type a skill and press Enter"
                className="w-full border-0 bg-transparent px-1 py-1 text-sm text-slate-900 outline-none placeholder:text-slate-400"
              />
            </div>
          </label>
        </div>

        <div className="md:col-span-2">
          <label className="block space-y-2">
            <span className="text-sm font-medium text-slate-700">Description</span>
            <textarea
              name="description"
              value={form.description}
              onChange={handleChange}
              rows={5}
              required
              placeholder="Describe the internship role, responsibilities, and expected outcomes."
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            />
          </label>
        </div>

        {error ? <p className="md:col-span-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}
        {success ? <p className="md:col-span-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{success}</p> : null}

        <div className="md:col-span-2 flex justify-end">
          <Button
            type="submit"
            disabled={submitting}
            className="border border-slate-900 bg-slate-900 text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? 'Processing...' : isEdit ? 'Update Changes' : 'Submit'}
          </Button>
        </div>
      </form>
    </Card>
  );
}
