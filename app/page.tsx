import LoanCalculator from "@/components/loan-calculator"

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-50 py-12">
      <div className="container px-4 md:px-6">
        <div className="mx-auto max-w-4xl space-y-6">
          <div className="space-y-2 text-center">
            <h1 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl">Loan Repayment Calculator</h1>
            <p className="mx-auto max-w-[600px] text-slate-500 md:text-xl/relaxed">
              Calculate your loan EMI and view detailed repayment schedule
            </p>
          </div>
          <LoanCalculator />
        </div>
      </div>
    </main>
  )
}

