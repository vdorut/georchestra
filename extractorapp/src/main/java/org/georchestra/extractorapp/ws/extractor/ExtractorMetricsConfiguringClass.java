package org.georchestra.extractorapp.ws.extractor;

import java.lang.management.ManagementFactory;
import java.net.InetSocketAddress;
import java.util.concurrent.TimeUnit;

import javax.annotation.PostConstruct;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import com.codahale.metrics.ConsoleReporter;
import com.codahale.metrics.MetricFilter;
import com.codahale.metrics.MetricRegistry;
import com.codahale.metrics.SharedMetricRegistries;
import com.ryantenney.metrics.spring.config.annotation.EnableMetrics;
import com.ryantenney.metrics.spring.config.annotation.MetricsConfigurerAdapter;
import com.codahale.metrics.graphite.Graphite;
import com.codahale.metrics.graphite.GraphiteReporter;

import com.codahale.metrics.jvm.*;

@Configuration
@EnableMetrics(proxyTargetClass = true)
public class ExtractorMetricsConfiguringClass extends MetricsConfigurerAdapter {

	private MetricRegistry metricRegistry = new MetricRegistry();

	@Override
	@Bean
	public MetricRegistry getMetricRegistry() {
		return metricRegistry;
	}

	@PostConstruct
	public void init() {
		// JVM Metrics
		metricRegistry.register("jvm.memory", new MemoryUsageGaugeSet());
		metricRegistry.register("jvm.garbage", new GarbageCollectorMetricSet());
		metricRegistry.register("jvm.threads", new ThreadStatesGaugeSet());
		metricRegistry.register("jvm.files", new FileDescriptorRatioGauge());
		metricRegistry.register("jvm.buffers", new BufferPoolMetricSet(ManagementFactory.getPlatformMBeanServer()));
		metricRegistry.register("jvm.class", new ClassLoadingGaugeSet());
		// metricRegistry.register("jvm.deadrtead",new
		// ThreadDeadlockDetector(ManagementFactory.getThreadMXBean()));

	//	registerReporter(ConsoleReporter.forRegistry(metricRegistry).build()).start(1, TimeUnit.SECONDS);
		
//graphite reporter
		final Graphite graphite = new Graphite(new InetSocketAddress("georchestra_graphite_1", 2003));
		final GraphiteReporter reporter = GraphiteReporter.forRegistry(metricRegistry).prefixedWith("extractor-app")
				.convertRatesTo(TimeUnit.SECONDS).convertDurationsTo(TimeUnit.MILLISECONDS).filter(MetricFilter.ALL)
				.build(graphite);
		reporter.start(1, TimeUnit.MINUTES);

	}

}