const escapeHtml = (value) => String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const formatDatePart = (date, timezone) => new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: 'short',
    day: 'numeric',
}).format(date);

const formatTimePart = (date, timezone) => new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
}).format(date);

const toDurationMinutes = (startTime, endTime) => {
    if (!(startTime instanceof Date) || !(endTime instanceof Date)) {
        return 30;
    }

    const diff = Math.round((endTime.getTime() - startTime.getTime()) / 60000);
    return Number.isFinite(diff) && diff > 0 ? diff : 30;
};

export function buildDemoMeetingContent({
    firstName,
    customerName,
    customerEmail,
    companyName,
    assignedMemberName,
    timezone,
    startTime,
    endTime,
    meetingLink,
}) {
    const resolvedStart = startTime instanceof Date ? startTime : new Date(startTime);
    const resolvedEnd = endTime instanceof Date ? endTime : new Date(endTime);
    const resolvedTimezone = String(timezone || 'UTC').trim() || 'UTC';
    const resolvedCustomerName = String(customerName || '').trim();
    const resolvedFirstName = String(firstName || resolvedCustomerName.split(/\s+/)[0] || '').trim();
    const resolvedCustomerEmail = String(customerEmail || '').trim();
    const resolvedCompanyName = String(companyName || '').trim();
    const resolvedHostName = String(assignedMemberName || '').trim();
    const resolvedMeetingLink = String(meetingLink || '').trim() || 'Included in your calendar invite';
    const resolvedDate = formatDatePart(resolvedStart, resolvedTimezone);
    const resolvedTime = formatTimePart(resolvedStart, resolvedTimezone);
    const durationMinutes = toDurationMinutes(resolvedStart, resolvedEnd);

    const safeFirstName = escapeHtml(resolvedFirstName);
    const safeCustomerName = escapeHtml(resolvedCustomerName);
    const safeCustomerEmail = escapeHtml(resolvedCustomerEmail);
    const safeCompanyName = escapeHtml(resolvedCompanyName);
    const safeHostName = escapeHtml(resolvedHostName);
    const safeTimezone = escapeHtml(resolvedTimezone);
    const safeDate = escapeHtml(resolvedDate);
    const safeTime = escapeHtml(resolvedTime);
    const safeMeetingLink = escapeHtml(resolvedMeetingLink);

    const subject = `Demo Booking Confirmed: ${resolvedCustomerName} | ${resolvedDate}`;
    const html = `
        <div style="font-family:Arial,sans-serif;color:#111827;line-height:1.6;">
            <p>Hi ${safeFirstName},</p>
            <p>Your demo with <strong>HireX REC</strong> has been successfully scheduled. We&rsquo;re looking forward to connecting with you!</p>

            <p><strong>Demo Details:</strong></p>
            <ul>
                <li><strong>Date &amp; Time:</strong> ${safeDate}, ${safeTime}</li>
                <li><strong>Timezone:</strong> ${safeTimezone}</li>
                <li><strong>Duration:</strong> ${durationMinutes} minutes</li>
                <li><strong>Meeting Link:</strong> ${safeMeetingLink}</li>
                <li><strong>Demo Host (Hirexit):</strong> ${safeHostName}</li>
            </ul>

            <p><strong>Customer Information:</strong></p>
            <ul>
                <li><strong>Name:</strong> ${safeCustomerName}</li>
                <li><strong>Email:</strong> ${safeCustomerEmail}</li>
                <li><strong>Company:</strong> ${safeCompanyName}</li>
            </ul>

            <p>If you need to reschedule or update any details, simply reply to this email.</p>
            <p>Looking forward to speaking with you!</p>

            <p>Best regards,<br/>HireX REC Team</p>
        </div>
    `.trim();

    const text = [
        `Hi ${resolvedFirstName},`,
        '',
        'Your demo with HireX REC has been successfully scheduled. We\'re looking forward to connecting with you!',
        '',
        'Demo Details:',
        `- Date & Time: ${resolvedDate}, ${resolvedTime}`,
        `- Timezone: ${resolvedTimezone}`,
        `- Duration: ${durationMinutes} minutes`,
        `- Meeting Link: ${resolvedMeetingLink}`,
        `- Demo Host (Hirexit): ${resolvedHostName}`,
        '',
        'Customer Information:',
        `- Name: ${resolvedCustomerName}`,
        `- Email: ${resolvedCustomerEmail}`,
        `- Company: ${resolvedCompanyName}`,
        '',
        'If you need to reschedule or update any details, simply reply to this email.',
        'Looking forward to speaking with you!',
        '',
        'Best regards,',
        'HireX REC Team',
    ].join('\n');

    return {
        subject,
        body: {
            contentType: 'HTML',
            content: html,
        },
        text,
    };
}
