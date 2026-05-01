// fee.go contains the PaperTrader fee calculation logic.
package services

import "math"

func CalculateFee(assetType string, tradeValue float64) float64 {
	var rate, minimum float64

	switch assetType {
	case "stock", "etf":
		rate = 0.001
		minimum = 1.00
	case "crypto":
		rate = 0.0025
		minimum = 0.50
	case "forex":
		rate = 0.0005
		minimum = 0.50
	case "commodity":
		rate = 0.0015
		minimum = 1.00
	default:
		rate = 0.001
		minimum = 1.00
	}

	fee := tradeValue * rate
	if fee < minimum {
		fee = minimum
	}
	return math.Round(fee*100) / 100
}
