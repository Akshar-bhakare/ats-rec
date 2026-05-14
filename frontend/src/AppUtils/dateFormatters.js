
export const getLongDateTimeStr = (dteObj = new Date()) => {
    const weekday = dteObj.toLocaleString('en-US', { weekday: 'short' });
    const month = dteObj.toLocaleString('en-US', { month: 'short' });
    const day = dteObj.toLocaleString('en-US', { day: '2-digit' });
    const year = dteObj.toLocaleString('en-US', { year: 'numeric' });
    const time = dteObj.toLocaleString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
    });

    return `${weekday}, ${month} ${day} ${year} - ${time}`;
}