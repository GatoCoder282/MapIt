/**
 * Precompiled [mapit.hexagon-domain.gradle.kts][Mapit_hexagon_domain_gradle] script plugin.
 *
 * @see Mapit_hexagon_domain_gradle
 */
public
class Mapit_hexagonDomainPlugin : org.gradle.api.Plugin<org.gradle.api.Project> {
    override fun apply(target: org.gradle.api.Project) {
        try {
            Class
                .forName("Mapit_hexagon_domain_gradle")
                .getDeclaredConstructor(org.gradle.api.Project::class.java, org.gradle.api.Project::class.java)
                .newInstance(target, target)
        } catch (e: java.lang.reflect.InvocationTargetException) {
            throw e.targetException
        }
    }
}
