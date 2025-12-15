# OpenAI Quota Exceeded Error

You're seeing the error "429 You exceeded your current quota" which means your OpenAI API key has reached its usage limit.

## What This Means

This is a billing issue with your OpenAI account, not a problem with the application code. The error indicates that:

1. Your API key is correctly configured and working
2. You've used up your available quota for the current billing period
3. This could be due to:
   - Reaching your free trial credit limit ($5-18 depending on when you signed up)
   - Exceeding your usage limits on a paid account
   - Going over your rate limits (requests per minute)

## How to Resolve

### 1. Check Your Billing Details
- Go to [OpenAI Platform Billing](https://platform.openai.com/account/billing)
- Log in with your OpenAI account
- Check your current usage and limits

### 2. Add Payment Method (if needed)
- If you've exhausted your free credits, you'll need to add a payment method
- Go to [Billing Settings](https://platform.openai.com/account/billing/payment-methods)
- Add a credit card to continue using the service

### 3. Upgrade Your Plan
- Free trial accounts have usage limits
- Consider upgrading to a paid plan for higher limits
- Check [OpenAI Pricing](https://openai.com/pricing) for current rates

### 4. Monitor Usage
- Check your [usage dashboard](https://platform.openai.com/account/usage) regularly
- Set up usage limits to avoid unexpected charges
- The GPT-3.5-turbo model used in this app costs approximately $0.50 per 1 million tokens

## Temporary Workarounds

While you resolve the billing issue:

1. **Wait for quota reset**: Free trial quotas reset monthly
2. **Use the app sparingly**: Limit your interactions until the quota resets
3. **Test with shorter prompts**: This will use fewer tokens

## Cost Estimation

For reference, a typical conversation with this AI widget:
- Each user message: ~10-50 tokens
- Each AI response: ~100-300 tokens
- 1,000 conversations like this would cost approximately $0.05-0.20

## Prevention Tips

1. Set up billing alerts to notify you when you're approaching limits
2. Monitor your usage dashboard regularly
3. Consider implementing rate limiting in your application
4. Cache frequent responses to reduce API calls

## Need Help?

If you continue to have issues:
1. Check the [OpenAI Status Page](https://status.openai.com/) for service outages
2. Review the [API Error Codes Documentation](https://platform.openai.com/docs/guides/error-codes)
3. Contact OpenAI support through your account dashboard