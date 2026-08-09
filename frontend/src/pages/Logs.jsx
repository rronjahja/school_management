import PageHeader from '../components/ui/PageHeader.jsx';
import ActivityLog from '../components/settings/ActivityLog.jsx';

/**
 * Ditari i veprimeve — faqe më vete.
 *
 * Rrinte te Cilësimet, mes formularëve të konfigurimit, ndonëse nuk
 * është konfigurim: nuk ndryshon asgjë, vetëm tregon se çfarë ndodhi.
 * Aty edhe humbte, sepse te Cilësimet shkohet rrallë, kurse te ditari i
 * veprimeve shkohet pikërisht kur diçka duhet gjetur shpejt.
 */
export default function Logs() {
    return (
        <>
            <PageHeader
                title="Ditari i veprimeve"
                subtitle="Çdo ndryshim në sistem, me kohën dhe përdoruesin që e bëri"
            />

            <ActivityLog />
        </>
    );
}