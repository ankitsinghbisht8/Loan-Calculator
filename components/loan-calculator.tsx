"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { CalendarIcon, HelpCircle, Download } from "lucide-react"
import { format } from "date-fns"
import { Line, Bar } from "react-chartjs-2"
import { CSVLink } from "react-csv"
import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip as ChartTooltip,
  Legend,
  BarElement,
} from "chart.js"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Card, CardContent } from "@/components/ui/card"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"

// Register ChartJS components
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, ChartTooltip, Legend, BarElement)

interface ScheduleRow {
  date: Date
  payment: number
  interest: number
  principal: number
  balance: number
}

interface ValidationErrors {
  principal?: string
  tenure?: string
  rate?: string
  moratorium?: string
}

export default function LoanCalculator() {
  const [darkMode, setDarkMode] = useState(false)
  const [date, setDate] = useState<Date>()
  const [schedule, setSchedule] = useState<ScheduleRow[]>([])
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<ValidationErrors>({})
  const [formData, setFormData] = useState({
    principal: "",
    tenure: "",
    rate: "",
    frequency: "monthly",
    moratorium: "0",
  })

  // Toggle dark mode
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add("dark")
    } else {
      document.documentElement.classList.remove("dark")
    }
  }, [darkMode])

  const validateForm = (data: typeof formData) => {
    const newErrors: ValidationErrors = {}

    if (Number(data.principal) <= 0) {
      newErrors.principal = "Principal amount must be greater than 0"
    }
    if (Number(data.tenure) <= 0) {
      newErrors.tenure = "Tenure must be greater than 0"
    }
    if (Number(data.rate) < 0) {
      newErrors.rate = "Interest rate cannot be negative"
    }
    if (Number(data.moratorium) < 0) {
      newErrors.moratorium = "Moratorium period cannot be negative"
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleFrequencyChange = (value: string) => {
    setFormData((prev) => ({ ...prev, frequency: value }))
  }

  useEffect(() => {
    if (date && Object.values(formData).every(Boolean)) {
      calculateSchedule()
    }
  }, [date, formData])

  const calculateSchedule = () => {
    if (!validateForm(formData)) return

    setLoading(true)

    const principal = Number(formData.principal)
    const tenure = Number(formData.tenure)
    const rate = Number(formData.rate)
    const frequency = formData.frequency
    const moratorium = Number(formData.moratorium)

    if (!date) {
      setLoading(false)
      return
    }

    // Calculate payments based on frequency
    const periodsPerYear = {
      monthly: 12,
      quarterly: 4,
      "semi-annually": 2,
      annually: 1,
    }[frequency]

    if (!periodsPerYear) {
      setLoading(false)
      return
    }

    const totalPeriods = tenure * periodsPerYear
    const periodicRate = rate / 100 / periodsPerYear

    // Calculate EMI
    const emi =
      (principal * periodicRate * Math.pow(1 + periodicRate, totalPeriods)) /
      (Math.pow(1 + periodicRate, totalPeriods) - 1)

    let balance = principal
    const newSchedule: ScheduleRow[] = []
    const currentDate = new Date(date)

    // Add moratorium period
    currentDate.setMonth(currentDate.getMonth() + moratorium)

    for (let i = 0; i < totalPeriods; i++) {
      const interest = balance * periodicRate
      const principal = emi - interest
      balance = balance - principal

      newSchedule.push({
        date: new Date(currentDate),
        payment: emi,
        interest,
        principal,
        balance: Math.max(0, balance),
      })

      // Increment date based on frequency
      if (frequency === "monthly") {
        currentDate.setMonth(currentDate.getMonth() + 1)
      } else if (frequency === "quarterly") {
        currentDate.setMonth(currentDate.getMonth() + 3)
      } else if (frequency === "semi-annually") {
        currentDate.setMonth(currentDate.getMonth() + 6)
      } else {
        currentDate.setFullYear(currentDate.getFullYear() + 1)
      }
    }

    setSchedule(newSchedule)
    setLoading(false)
  }

  const downloadPDF = () => {
    const doc = new jsPDF()

    doc.text("Loan Repayment Schedule", 14, 15)

    const tableData = schedule.map((row) => [
      format(row.date, "PP"),
      row.payment.toFixed(2),
      row.interest.toFixed(2),
      row.principal.toFixed(2),
      row.balance.toFixed(2),
    ])

    autoTable(doc, {
      head: [["Date", "Payment", "Interest", "Principal", "Balance"]],
      body: tableData,
      startY: 20,
    })

    doc.save("loan-schedule.pdf")
  }

  const chartData = {
    labels: schedule.map((row) => format(row.date, "PP")),
    datasets: [
      {
        label: "Outstanding Balance",
        data: schedule.map((row) => row.balance),
        borderColor: "rgb(14, 165, 233)",
        backgroundColor: "rgba(14, 165, 233, 0.1)",
        fill: true,
      },
      {
        label: "EMI Payment",
        data: schedule.map((row) => row.payment),
        borderColor: "rgb(34, 197, 94)",
        backgroundColor: "rgba(34, 197, 94, 0.1)",
        fill: true,
      },
    ],
  }

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "top" as const,
        labels: {
          color: darkMode ? "rgb(241, 245, 249)" : "rgb(15, 23, 42)",
        },
      },
      title: {
        display: true,
        text: "Loan Amortization Chart",
        color: darkMode ? "rgb(241, 245, 249)" : "rgb(15, 23, 42)",
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: {
          color: darkMode ? "rgba(241, 245, 249, 0.1)" : "rgba(15, 23, 42, 0.1)",
        },
        ticks: {
          color: darkMode ? "rgb(241, 245, 249)" : "rgb(15, 23, 42)",
        },
      },
      x: {
        grid: {
          color: darkMode ? "rgba(241, 245, 249, 0.1)" : "rgba(15, 23, 42, 0.1)",
        },
        ticks: {
          color: darkMode ? "rgb(241, 245, 249)" : "rgb(15, 23, 42)",
        },
      },
    },
  }

  const csvData = [
    ["Date", "Payment", "Interest", "Principal", "Balance"],
    ...schedule.map((row) => [
      format(row.date, "PP"),
      row.payment.toFixed(2),
      row.interest.toFixed(2),
      row.principal.toFixed(2),
      row.balance.toFixed(2),
    ]),
  ]

  return (
    <div
      className={cn(
        "space-y-8 rounded-lg border bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900",
        darkMode && "dark",
      )}
    >
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold dark:text-white">Loan Calculator</h2>
        <div className="flex items-center gap-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center space-x-2">
                  <Label htmlFor="dark-mode" className="dark:text-white">
                    Dark Mode
                  </Label>
                  <Switch id="dark-mode" checked={darkMode} onCheckedChange={setDarkMode} />
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>Toggle dark mode</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      <div className="grid gap-8">
        <div className="grid gap-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="date" className="dark:text-white">
                Disbursement Date
              </Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant={"outline"}
                    className={cn(
                      "w-full justify-start text-left font-normal dark:bg-slate-800 dark:text-white",
                      !date && "text-muted-foreground",
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {date ? format(date, "PPP") : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={date}
                    onSelect={setDate}
                    initialFocus
                    className="dark:bg-slate-800"
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label htmlFor="principal" className="dark:text-white">
                  Principal Amount
                </Label>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <HelpCircle className="h-4 w-4 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>The initial loan amount you wish to borrow</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <Input
                id="principal"
                name="principal"
                type="number"
                min="0"
                step="0.01"
                value={formData.principal}
                onChange={handleInputChange}
                className="w-full dark:bg-slate-800 dark:text-white"
              />
              {errors.principal && <p className="text-sm text-destructive">{errors.principal}</p>}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label htmlFor="tenure" className="dark:text-white">
                  Tenure (Years)
                </Label>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <HelpCircle className="h-4 w-4 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>The duration of the loan in years</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <Input
                id="tenure"
                name="tenure"
                type="number"
                min="1"
                step="1"
                value={formData.tenure}
                onChange={handleInputChange}
                className="w-full dark:bg-slate-800 dark:text-white"
              />
              {errors.tenure && <p className="text-sm text-destructive">{errors.tenure}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="frequency" className="dark:text-white">
                EMI Frequency
              </Label>
              <Select name="frequency" value={formData.frequency} onValueChange={handleFrequencyChange}>
                <SelectTrigger className="dark:bg-slate-800 dark:text-white">
                  <SelectValue placeholder="Select frequency" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="quarterly">Quarterly</SelectItem>
                  <SelectItem value="semi-annually">Semi-Annually</SelectItem>
                  <SelectItem value="annually">Annually</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label htmlFor="rate" className="dark:text-white">
                  Interest Rate (%)
                </Label>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <HelpCircle className="h-4 w-4 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Annual interest rate as a percentage</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <Input
                id="rate"
                name="rate"
                type="number"
                min="0"
                step="0.01"
                value={formData.rate}
                onChange={handleInputChange}
                className="w-full dark:bg-slate-800 dark:text-white"
              />
              {errors.rate && <p className="text-sm text-destructive">{errors.rate}</p>}
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label htmlFor="moratorium" className="dark:text-white">
                  Moratorium Period (Months)
                </Label>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <HelpCircle className="h-4 w-4 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Initial period where no repayment is required</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <Input
                id="moratorium"
                name="moratorium"
                type="number"
                min="0"
                step="1"
                value={formData.moratorium}
                onChange={handleInputChange}
                className="w-full dark:bg-slate-800 dark:text-white"
              />
              {errors.moratorium && <p className="text-sm text-destructive">{errors.moratorium}</p>}
            </div>
          </div>
        </div>

        {schedule.length > 0 && (
          <div className="space-y-6">
            <Card className="dark:bg-slate-800">
              <CardContent className="p-6">
                <div className="h-[300px] w-full">
                  <Line options={chartOptions} data={chartData} />
                </div>
              </CardContent>
            </Card>

            <Card className="dark:bg-slate-800">
              <CardContent className="p-6">
                <div className="h-[200px] w-full">
                  <Bar
                    options={{
                      ...chartOptions,
                      maintainAspectRatio: false,
                      plugins: {
                        ...chartOptions.plugins,
                        title: {
                          display: true,
                          text: "EMI Breakdown",
                          color: darkMode ? "rgb(241, 245, 249)" : "rgb(15, 23, 42)",
                        },
                      },
                      scales: {
                        x: {
                          stacked: true,
                          grid: {
                            color: darkMode ? "rgba(241, 245, 249, 0.1)" : "rgba(15, 23, 42, 0.1)",
                          },
                          ticks: {
                            color: darkMode ? "rgb(241, 245, 249)" : "rgb(15, 23, 42)",
                          },
                        },
                        y: {
                          stacked: true,
                          beginAtZero: true,
                          grid: {
                            color: darkMode ? "rgba(241, 245, 249, 0.1)" : "rgba(15, 23, 42, 0.1)",
                          },
                          ticks: {
                            color: darkMode ? "rgb(241, 245, 249)" : "rgb(15, 23, 42)",
                          },
                        },
                      },
                    }}
                    data={{
                      labels: schedule.map((row) => format(row.date, "PP")),
                      datasets: [
                        {
                          label: "Principal",
                          data: schedule.map((row) => row.principal),
                          backgroundColor: "rgb(34, 197, 94)",
                        },
                        {
                          label: "Interest",
                          data: schedule.map((row) => row.interest),
                          backgroundColor: "rgb(14, 165, 233)",
                        },
                      ],
                    }}
                  />
                </div>
              </CardContent>
            </Card>

            <div className="flex flex-wrap gap-2">
              <CSVLink
                data={csvData}
                filename="loan-schedule.csv"
                className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
              >
                <Download className="mr-2 h-4 w-4" />
                Download CSV
              </CSVLink>
              <Button onClick={downloadPDF} variant="outline" className="dark:bg-slate-800 dark:text-white">
                <Download className="mr-2 h-4 w-4" />
                Download PDF
              </Button>
            </div>

            <div className="overflow-x-auto -mx-6 px-6">
              <div className="min-w-[800px]">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b bg-slate-50 dark:border-slate-700 dark:bg-slate-800">
                      <th className="p-4 text-left font-medium text-slate-600 dark:text-slate-200">Date</th>
                      <th className="p-4 text-right font-medium text-slate-600 dark:text-slate-200">Payment</th>
                      <th className="p-4 text-right font-medium text-slate-600 dark:text-slate-200">Interest</th>
                      <th className="p-4 text-right font-medium text-slate-600 dark:text-slate-200">Principal</th>
                      <th className="p-4 text-right font-medium text-slate-600 dark:text-slate-200">Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {schedule.map((row, index) => (
                      <tr
                        key={index}
                        className="border-b transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-white dark:hover:bg-slate-800"
                      >
                        <td className="p-4">{format(row.date, "PP")}</td>
                        <td className="p-4 text-right">{row.payment.toFixed(2)}</td>
                        <td className="p-4 text-right">{row.interest.toFixed(2)}</td>
                        <td className="p-4 text-right">{row.principal.toFixed(2)}</td>
                        <td className="p-4 text-right">{row.balance.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

