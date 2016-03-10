package org.georchestra.extractorapp.ws.extractor;
import java.lang.management.ManagementFactory;
import java.net.InetSocketAddress;
import java.util.concurrent.TimeUnit;

import javax.annotation.PostConstruct;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import com.codahale.metrics.ConsoleReporter;
import com.codahale.metrics.JmxReporter;
import com.codahale.metrics.MetricFilter;
import com.codahale.metrics.MetricRegistry;
import com.codahale.metrics.SharedMetricRegistries;
import com.codahale.metrics.health.HealthCheckRegistry;
import com.ryantenney.metrics.spring.config.annotation.EnableMetrics;
import com.ryantenney.metrics.spring.config.annotation.MetricsConfigurerAdapter;
import com.codahale.metrics.graphite.Graphite;
import com.codahale.metrics.graphite.GraphiteReporter;



@Configuration
@EnableMetrics(proxyTargetClass = true)
public class SpringConfiguringClass extends MetricsConfigurerAdapter {
	

    private static final String PROP_METRIC_REG_JVM_MEMORY = "jvm.memory";
    private static final String PROP_METRIC_REG_JVM_GARBAGE = "jvm.garbage";
    private static final String PROP_METRIC_REG_JVM_THREADS = "jvm.threads";
    private static final String PROP_METRIC_REG_JVM_FILES = "jvm.files";
    private static final String PROP_METRIC_REG_JVM_BUFFERS = "jvm.buffers";


    private MetricRegistry metricRegistry = new MetricRegistry();

    private HealthCheckRegistry healthCheckRegistry = new HealthCheckRegistry();

    
    
    @Override
    @Bean
    public MetricRegistry getMetricRegistry() {
        return metricRegistry;
    }

    @Override
    @Bean
    public HealthCheckRegistry getHealthCheckRegistry() {
        return healthCheckRegistry;
    }

    @PostConstruct
    public void init() {

       
        //metricRegistry.register(PROP_METRIC_REG_JVM_FILES, new FileDescriptorRatioGauge());
        //metricRegistry.register(PROP_METRIC_REG_JVM_BUFFERS, new BufferPoolMetricSet(ManagementFactory.getPlatformMBeanServer()));

            JmxReporter jmxReporter = JmxReporter.forRegistry(metricRegistry).build();
            jmxReporter.start();
        
         // registerReporter allows the MetricsConfigurerAdapter to
            // shut down the reporter when the Spring context is closed
            registerReporter(ConsoleReporter
                    .forRegistry(metricRegistry)
                    .build())
                    .start(1, TimeUnit.SECONDS);
     
            final Graphite graphite = new Graphite(new InetSocketAddress("georchestra_graphite_1", 2003));
            final GraphiteReporter reporter = GraphiteReporter.forRegistry(metricRegistry)
                                                              .prefixedWith("extractor-app")
                                                              .convertRatesTo(TimeUnit.SECONDS)
                                                              .convertDurationsTo(TimeUnit.MILLISECONDS)
                                                              .filter(MetricFilter.ALL)
                                                              .build(graphite);
            reporter.start(1, TimeUnit.MINUTES);
            

    }
    



}