"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [employee, setEmployee] = useState<any>(null);

  // Step 1: Personal
  const [department, setDepartment] = useState("");
  const [designation, setDesignation] = useState("");
  const [joiningDate, setJoiningDate] = useState("");

  // Step 2: Bank
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [ifscCode, setIfscCode] = useState("");
  const [accountHolder, setAccountHolder] = useState("");

  // Step 3: Emergency
  const [ecName, setEcName] = useState("");
  const [ecPhone, setEcPhone] = useState("");
  const [ecRelationship, setEcRelationship] = useState("");

  // Step 4: Attrition survey (data for ML model)
  const [age, setAge] = useState("");
  const [distanceFromHome, setDistanceFromHome] = useState("");
  const [education, setEducation] = useState("3");
  const [numCompaniesWorked, setNumCompaniesWorked] = useState("");
  const [totalWorkingYears, setTotalWorkingYears] = useState("");
  const [maritalStatus, setMaritalStatus] = useState("Single");
  const [overtime, setOvertime] = useState("No");
  const [jobSatisfaction, setJobSatisfaction] = useState("3");
  const [workLifeBalance, setWorkLifeBalance] = useState("3");
  const [jobInvolvement, setJobInvolvement] = useState("3");

  useEffect(() => {
    api.get("/employees/me").then(emp => {
      setEmployee(emp);
      if (emp.onboarding_status === "completed") router.replace("/employee/dashboard");
      if (emp.department) setDepartment(emp.department);
      if (emp.designation) setDesignation(emp.designation);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [router]);

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await api.post("/employees/onboarding", {
        department, designation, joining_date: joiningDate,
        bank_details: { bank_name: bankName, account_number: accountNumber, ifsc_code: ifscCode, account_holder: accountHolder },
        emergency_contact: { name: ecName, phone: ecPhone, relationship: ecRelationship },
        attrition_survey: {
          age: parseInt(age) || 28,
          distance_from_home: parseInt(distanceFromHome) || 10,
          education: parseInt(education),
          num_companies_worked: parseInt(numCompaniesWorked) || 1,
          total_working_years: parseInt(totalWorkingYears) || 0,
          marital_status: maritalStatus,
          overtime: overtime === "Yes",
          job_satisfaction: parseInt(jobSatisfaction),
          work_life_balance: parseInt(workLifeBalance),
          job_involvement: parseInt(jobInvolvement),
        },
      });
      router.push("/employee/dashboard");
    } catch (e: any) { alert(e.message); }
    finally { setSubmitting(false); }
  };

  if (loading) return <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600" /></div>;

  const totalSteps = 4;

  return (
    <div className="max-w-xl mx-auto">
      <div className="text-center mb-8">
        <div className="w-16 h-16 bg-teal-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <span className="text-3xl">🎉</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">Welcome Aboard!</h1>
        <p className="text-sm text-gray-500 mt-1">Employee ID: {employee?.employee_id} — Complete your onboarding</p>
      </div>

      {/* Progress */}
      <div className="flex items-center justify-center gap-2 mb-8">
        {Array.from({ length: totalSteps }, (_, i) => i + 1).map(s => (
          <div key={s} className="flex items-center">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
              step >= s ? "bg-teal-600 text-white" : "bg-gray-200 text-gray-400"
            }`}>{s}</div>
            {s < totalSteps && <div className={`w-8 h-0.5 ${step > s ? "bg-teal-500" : "bg-gray-200"}`} />}
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 p-8 shadow-sm">
        {step === 1 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Personal Details</h2>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
              <input type="text" value={department} onChange={e => setDepartment(e.target.value)}
                placeholder="e.g., Engineering" className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Designation</label>
              <input type="text" value={designation} onChange={e => setDesignation(e.target.value)}
                placeholder="e.g., Software Engineer" className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Joining Date</label>
              <input type="date" value={joiningDate} onChange={e => setJoiningDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
            </div>
            <button onClick={() => setStep(2)} className="w-full bg-teal-600 text-white py-2.5 rounded-lg hover:bg-teal-700 font-medium">Next</button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Bank Details</h2>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Bank Name</label>
              <input type="text" value={bankName} onChange={e => setBankName(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Account Number</label>
              <input type="text" value={accountNumber} onChange={e => setAccountNumber(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">IFSC Code</label>
              <input type="text" value={ifscCode} onChange={e => setIfscCode(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Account Holder Name</label>
              <input type="text" value={accountHolder} onChange={e => setAccountHolder(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setStep(1)} className="flex-1 border border-gray-300 py-2.5 rounded-lg hover:bg-gray-50">Back</button>
              <button onClick={() => setStep(3)} className="flex-1 bg-teal-600 text-white py-2.5 rounded-lg hover:bg-teal-700 font-medium">Next</button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Emergency Contact</h2>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Contact Name</label>
              <input type="text" value={ecName} onChange={e => setEcName(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
              <input type="tel" value={ecPhone} onChange={e => setEcPhone(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Relationship</label>
              <input type="text" value={ecRelationship} onChange={e => setEcRelationship(e.target.value)} placeholder="e.g., Parent, Spouse" className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setStep(2)} className="flex-1 border border-gray-300 py-2.5 rounded-lg hover:bg-gray-50">Back</button>
              <button onClick={() => setStep(4)} className="flex-1 bg-teal-600 text-white py-2.5 rounded-lg hover:bg-teal-700 font-medium">Next</button>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Employee Survey</h2>
            <p className="text-xs text-gray-400">This helps us understand your work preferences and provide better support.</p>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Age</label>
                <input type="number" value={age} onChange={e => setAge(e.target.value)} placeholder="28" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Distance from Home (km)</label>
                <input type="number" value={distanceFromHome} onChange={e => setDistanceFromHome(e.target.value)} placeholder="10" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Total Working Years</label>
                <input type="number" value={totalWorkingYears} onChange={e => setTotalWorkingYears(e.target.value)} placeholder="3" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Companies Worked At</label>
                <input type="number" value={numCompaniesWorked} onChange={e => setNumCompaniesWorked(e.target.value)} placeholder="2" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Education Level</label>
                <select value={education} onChange={e => setEducation(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                  <option value="1">Below College</option>
                  <option value="2">College</option>
                  <option value="3">Bachelor's</option>
                  <option value="4">Master's</option>
                  <option value="5">Doctorate</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Marital Status</label>
                <select value={maritalStatus} onChange={e => setMaritalStatus(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                  <option value="Single">Single</option>
                  <option value="Married">Married</option>
                  <option value="Divorced">Divorced</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Work-Life Balance</label>
                <select value={workLifeBalance} onChange={e => setWorkLifeBalance(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                  <option value="1">Bad</option>
                  <option value="2">Below Average</option>
                  <option value="3">Good</option>
                  <option value="4">Excellent</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Job Satisfaction</label>
                <select value={jobSatisfaction} onChange={e => setJobSatisfaction(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                  <option value="1">Low</option>
                  <option value="2">Medium</option>
                  <option value="3">High</option>
                  <option value="4">Very High</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Job Involvement</label>
                <select value={jobInvolvement} onChange={e => setJobInvolvement(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                  <option value="1">Low</option>
                  <option value="2">Medium</option>
                  <option value="3">High</option>
                  <option value="4">Very High</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Regular Overtime?</label>
                <select value={overtime} onChange={e => setOvertime(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                  <option value="No">No</option>
                  <option value="Yes">Yes</option>
                </select>
              </div>
            </div>

            <div className="flex gap-3 mt-4">
              <button onClick={() => setStep(3)} className="flex-1 border border-gray-300 py-2.5 rounded-lg hover:bg-gray-50">Back</button>
              <button onClick={handleSubmit} disabled={submitting}
                className="flex-1 bg-teal-600 text-white py-2.5 rounded-lg hover:bg-teal-700 font-medium disabled:opacity-50">
                {submitting ? "Submitting..." : "Complete Onboarding"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
