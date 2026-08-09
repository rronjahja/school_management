import PageHeader from '../components/ui/PageHeader.jsx';
import ClassManager from '../components/settings/ClassManager.jsx';
import ProfessorManager from '../components/settings/ProfessorManager.jsx';

/**
 * Administrata — puna e përditshme e organizimit të shkollës.
 *
 * Paralelet dhe kujdestarët rrinin më parë te Cilësimet, bashkë me
 * konfigurimin e sistemit. Por krijimi i një paraleleje nuk është
 * konfigurim: bëhet çdo shtator dhe e bën edhe stafi. Prandaj u nda
 * në faqe të vetën, që Cilësimet të mbeten vetëm te administratori.
 */
export default function Administrata() {
    return (
        <>
            <PageHeader
                title="Administrata"
                subtitle="Paralelet, kujdestarët, profesorët dhe lëndët"
            />

            <ClassManager />

            <ProfessorManager />
        </>
    );
}